import cv2
import numpy as np
from pathlib import Path

from .config import Settings
from .models import ProgressBar, CVStructure


class OpenCVAnalyzer:
    def __init__(self, settings: Settings):
        self.settings = settings

    def analyze(self, img: np.ndarray) -> CVStructure:
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        bars = self._detect_progress_bars(img, gray)
        layout = self._detect_layout(gray, w)
        dark_bg = self._detect_dark_backgrounds(gray, w, h)
        sections = self._detect_sections(gray, w)
        has_indicators = self._has_level_indicators(bars, h)
        detected_software_icons = self._detect_software_icons(img)

        return CVStructure(
            layout=layout,
            has_dark_sidebar=len(dark_bg) > 0,
            progress_bars=bars,
            sections=sections,
            detected_software_icons=detected_software_icons,
            image_width=w,
            image_height=h,
            dark_bg_regions=dark_bg,
            has_level_indicators=has_indicators,
        )

    def _software_icon_template_map(self) -> dict:
        return {
            "word": "Microsoft Word",
            "microsoft_word": "Microsoft Word",
            "excel": "Microsoft Excel",
            "microsoft_excel": "Microsoft Excel",
            "outlook": "Microsoft Outlook",
            "microsoft_outlook": "Microsoft Outlook",
            "powerpoint": "Microsoft PowerPoint",
            "power_point": "Microsoft PowerPoint",
            "microsoft_powerpoint": "Microsoft PowerPoint",
            "microsoft_power_point": "Microsoft PowerPoint",
            "onenote": "Microsoft OneNote",
            "one_note": "Microsoft OneNote",
            "microsoft_onenote": "Microsoft OneNote",
            "microsoft_one_note": "Microsoft OneNote",
            "ebp": "EBP",
            "divalto": "Divalto",
        }

    def _load_software_icon_templates(self) -> list:
        template_dir = Path(getattr(self.settings, "software_icon_templates_dir", ""))
        if not template_dir.exists() or not template_dir.is_dir():
            return []

        templates = []
        name_map = self._software_icon_template_map()
        for path in template_dir.iterdir():
            if path.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
                continue
            canonical_name = name_map.get(path.stem.casefold())
            if not canonical_name:
                continue
            template = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
            if template is None or template.size == 0:
                continue
            th, tw = template.shape[:2]
            if th < 8 or tw < 8:
                continue
            templates.append({
                "name": canonical_name,
                "path": str(path),
                "image": template,
            })
        return templates

    def _detect_software_icons(self, img: np.ndarray) -> list:
        templates = self._load_software_icon_templates()
        if not templates:
            return []

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        image_h, image_w = gray.shape[:2]
        detections = []

        for template_info in templates:
            base_template = cv2.equalizeHist(template_info["image"])
            best = None

            for scale in (0.60, 0.75, 0.90, 1.00, 1.15, 1.30, 1.50):
                tw = int(base_template.shape[1] * scale)
                th = int(base_template.shape[0] * scale)
                if tw < 8 or th < 8 or tw > image_w or th > image_h:
                    continue
                template = cv2.resize(base_template, (tw, th), interpolation=cv2.INTER_AREA)
                result = cv2.matchTemplate(gray, template, cv2.TM_CCOEFF_NORMED)
                _, max_val, _, max_loc = cv2.minMaxLoc(result)
                if best is None or max_val > best["confidence"]:
                    best = {
                        "name": template_info["name"],
                        "confidence": float(max_val),
                        "source": "icon",
                        "x": int(max_loc[0]),
                        "y": int(max_loc[1]),
                        "width": int(tw),
                        "height": int(th),
                    }

            if best and best["confidence"] >= 0.70:
                detections.append(best)

        return self._deduplicate_software_icons(detections)

    def _deduplicate_software_icons(self, detections: list) -> list:
        best_by_name = {}
        for detection in detections or []:
            name = detection.get("name")
            if not name:
                continue
            current = best_by_name.get(name)
            if current is None or detection.get("confidence", 0.0) > current.get("confidence", 0.0):
                best_by_name[name] = detection
        return sorted(
            best_by_name.values(),
            key=lambda row: row.get("confidence", 0.0),
            reverse=True,
        )

    def _has_level_indicators(self, bars: list, img_height: int) -> bool:
        y_min = int(img_height * 0.35)
        valid = [
            b for b in bars
            if b.y >= y_min
            and isinstance(b.fill_percent, (int, float))
            and 10 <= b.fill_percent <= 95
            and b.color not in ("white", "unknown", "dot")
        ]
        return len(valid) >= 2

    def _detect_progress_bars(self, img, gray):
        all_bars = []
        all_bars += self._detect_bicolor_bars(img, gray)
        all_bars += self._detect_classic_bars(img, gray)
        all_bars += self._detect_colored_bars(img)
        all_bars += self._detect_dot_indicators(img)
        all_bars.sort(key=lambda b: b.y)
        return self._deduplicate_bars(all_bars)

    def _detect_bicolor_bars(self, img, gray):
        bars = []
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        s_ch = hsv[:, :, 1].astype(np.float32)
        v_ch = hsv[:, :, 2].astype(np.float32)

        mask_colored = (s_ch > 15).astype(np.uint8) * 255
        mask_dark = (v_ch < 210).astype(np.uint8) * 255
        combined = cv2.bitwise_or(mask_colored, mask_dark)

        k = cv2.getStructuringElement(cv2.MORPH_RECT, (10, 2))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, k)
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            if not (w >= self.settings.min_bar_width and 2 <= h <= self.settings.max_bar_height and w / h >= self.settings.min_bar_ratio):
                continue

            roi_bgr = img[y:y + h, x:x + w]
            roi_hsv = hsv[y:y + h, x:x + w]
            fill_pct, color = self._compute_bicolor_fill(roi_bgr, roi_hsv)
            if fill_pct is None:
                continue

            bars.append(
                ProgressBar(
                    x=int(x),
                    y=int(y),
                    width=int(w),
                    height=int(h),
                    fill_percent=round(fill_pct, 1),
                    level=self._percent_to_level(fill_pct),
                    level_score=self._percent_to_score(fill_pct),
                    color=color,
                    shape_type="bar",
                )
            )
        return bars

    def _compute_bicolor_fill(self, roi_bgr, roi_hsv):
        if roi_bgr is None or roi_bgr.size == 0:
            return None, None

        h_roi, w_roi = roi_bgr.shape[:2]
        if w_roi < 10 or h_roi < 2:
            return None, None

        v = roi_hsv[:, :, 2].astype(np.float32)
        s = roi_hsv[:, :, 1].astype(np.float32)
        hh = roi_hsv[:, :, 0].astype(np.float32)

        mid = w_roi // 2
        colored_col = (s > 50).astype(np.float32)
        gray_col = ((s < 40) & (v > 90)).astype(np.float32)

        left_colored = np.mean(colored_col[:, :mid])
        right_colored = np.mean(colored_col[:, mid:])
        right_gray = np.mean(gray_col[:, mid:])
        total_colored = left_colored + right_colored

        if total_colored > 0.01:
            symmetry = min(left_colored, right_colored) / max(left_colored, right_colored)
            if symmetry > 0.70 and right_gray < 0.20:
                return None, None

        empty_gray = (s < 35) & (v > 90)
        empty_yellow = (hh >= 10) & (hh <= 45) & (s > 50) & (v > 120)
        empty_mask = empty_gray | empty_yellow

        filled_dark = (v < 80)
        filled_colored = (s > 50) & ((hh < 10) | (hh > 45))
        filled_mask = filled_dark | filled_colored

        n_filled = float(np.sum(filled_mask))
        n_empty = float(np.sum(empty_mask))
        total = n_filled + n_empty

        if total < 20:
            return None, None

        fill_pct = (n_filled / total) * 100
        if fill_pct < 3:
            return None, None

        color = self._detect_bar_color(roi_bgr)
        return round(fill_pct, 1), color

    def _detect_classic_bars(self, img, gray):
        bars = []
        edges = cv2.Canny(gray, 30, 100)
        kern = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 1))
        edges = cv2.dilate(edges, kern, iterations=1)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            if not (w >= self.settings.min_bar_width and 3 <= h <= self.settings.max_bar_height and w / h >= self.settings.min_bar_ratio):
                continue

            bar_region = gray[y:y + h, x:x + w]
            fill_pct = self._calculate_fill_classic(bar_region)
            if fill_pct < 3 or fill_pct > 97:
                continue

            color = self._detect_bar_color(img[y:y + h, x:x + w])

            bars.append(
                ProgressBar(
                    x=int(x),
                    y=int(y),
                    width=int(w),
                    height=int(h),
                    fill_percent=round(fill_pct, 1),
                    level=self._percent_to_level(fill_pct),
                    level_score=self._percent_to_score(fill_pct),
                    color=color,
                    shape_type="bar",
                )
            )
        return bars

    def _calculate_fill_classic(self, bar_region):
        if bar_region.size == 0:
            return 0.0
        _, binary = cv2.threshold(bar_region, 128, 255, cv2.THRESH_BINARY_INV)
        return (np.sum(binary > 0) / bar_region.size) * 100

    def _detect_colored_bars(self, img):
        bars = []
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        h_img, w_img = img.shape[:2]

        mask_red1 = cv2.inRange(hsv, (0, 60, 50), (15, 255, 255))
        mask_red2 = cv2.inRange(hsv, (160, 60, 50), (180, 255, 255))
        mask_red = cv2.bitwise_or(mask_red1, mask_red2)
        mask_blue = cv2.inRange(hsv, (100, 60, 50), (130, 255, 255))
        mask_green = cv2.inRange(hsv, (40, 60, 50), (80, 255, 255))
        mask_dark = cv2.inRange(hsv, (0, 0, 0), (180, 255, 80))
        mask_orange = cv2.inRange(hsv, (15, 80, 80), (35, 255, 255))

        combined = cv2.bitwise_or(mask_red, mask_blue)
        combined = cv2.bitwise_or(combined, mask_green)
        combined = cv2.bitwise_or(combined, mask_dark)
        combined = cv2.bitwise_or(combined, mask_orange)

        k = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 2))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, k)
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            if not (w >= self.settings.min_bar_width and 2 <= h <= self.settings.max_bar_height and w / h >= self.settings.min_bar_ratio):
                continue

            roi = img[y:y + h, x:x + w]
            color = self._detect_bar_color(roi)
            if color in ("white", "unknown"):
                continue

            row_start = max(0, y - 2)
            row_end = min(h_img, y + h + 2)
            row_slice = combined[row_start:row_end, :]
            row_proj = np.sum(row_slice, axis=0)
            nonzero = np.where(row_proj > 0)[0]
            if len(nonzero) == 0:
                continue

            full_width = int(nonzero[-1]) - int(nonzero[0])
            if full_width < self.settings.min_bar_width:
                full_width = w_img // 2

            fill_pct = min(99.0, max(1.0, (w / full_width) * 100))
            if fill_pct > 97 or fill_pct < 3:
                continue

            bars.append(
                ProgressBar(
                    x=int(x),
                    y=int(y),
                    width=int(w),
                    height=int(h),
                    fill_percent=round(fill_pct, 1),
                    level=self._percent_to_level(fill_pct),
                    level_score=self._percent_to_score(fill_pct),
                    color=color,
                    shape_type="bar",
                )
            )
        return bars

    def _detect_dot_indicators(self, img):
        bars = []
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        circles = cv2.HoughCircles(
            gray,
            cv2.HOUGH_GRADIENT,
            dp=1,
            minDist=8,
            param1=50,
            param2=15,
            minRadius=3,
            maxRadius=12
        )
        if circles is None:
            return bars

        circles = np.round(circles[0]).astype(int)
        circles_sorted = sorted(circles, key=lambda c: (c[1], c[0]))
        groups, used = [], set()

        for i, (cx, cy, cr) in enumerate(circles_sorted):
            if i in used:
                continue

            group = [(cx, cy, cr, i)]
            for j, (cx2, cy2, cr2) in enumerate(circles_sorted):
                if j != i and j not in used and abs(cy2 - cy) <= 10:
                    group.append((cx2, cy2, cr2, j))

            if len(group) >= 3:
                for *_, idx in group:
                    used.add(idx)
                groups.append(group)

        for group in groups:
            group.sort(key=lambda c: c[0])
            total = len(group)
            filled = sum(
                1 for cx, cy, cr, _ in group
                if (roi := gray[max(0, cy - cr):cy + cr, max(0, cx - cr):cx + cr]).size > 0
                and np.mean(roi) < 140
            )
            if filled == 0:
                continue

            fill_pct = (filled / total) * 100
            x_min = min(c[0] - c[2] for c in group)
            x_max = max(c[0] + c[2] for c in group)
            y_mid = int(np.mean([c[1] for c in group]))
            h_est = int(np.mean([c[2] for c in group])) * 2

            bars.append(
                ProgressBar(
                    x=int(x_min),
                    y=int(y_mid - h_est // 2),
                    width=int(x_max - x_min),
                    height=int(h_est),
                    fill_percent=round(fill_pct, 1),
                    level=self._percent_to_level(fill_pct),
                    level_score=self._percent_to_score(fill_pct),
                    color="dot",
                    shape_type="bar",
                )
            )

        return bars

    def _detect_bar_color(self, bar_roi):
        if bar_roi is None or bar_roi.size == 0:
            return "unknown"

        b, g, r, *_ = cv2.mean(bar_roi)

        if r > 200 and g > 200 and b > 200:
            return "white"
        if r < 80 and g < 80 and b < 80:
            return "dark"
        if r > 130 and g < 80 and b < 80:
            return "red"
        if r > 100 and r > g * 1.3 and r > b * 1.3:
            return "red"
        if r > 100 and g < 60 and b < 60:
            return "dark_red"
        if b > 130 and b > r * 1.3 and b > g:
            return "blue"
        if g > 130 and r < 100 and g > b:
            return "green"
        if r > 130 and g > 100 and b < 80:
            return "yellow"
        return "other"

    def _detect_layout(self, gray, width):
        mid = width // 2
        lc = np.sum(gray[:, :mid] < 150)
        rc = np.sum(gray[:, mid:] < 150)
        tot = lc + rc
        if tot == 0:
            return "single_column"
        r = min(lc, rc) / max(lc, rc)
        if r > 0.35:
            return "two_columns"
        if r > 0.15:
            return "sidebar"
        return "single_column"

    def _detect_dark_backgrounds(self, gray, w, h):
        dark_regions = []
        _, dark_mask = cv2.threshold(gray, 80, 255, cv2.THRESH_BINARY_INV)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (50, 50))
        dark_merged = cv2.morphologyEx(dark_mask, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(dark_merged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            cx, cy, cw, ch = cv2.boundingRect(cnt)
            ar = (cw * ch) / (w * h)
            if 0.05 < ar < 0.45:
                dark_regions.append({
                    "x": int(cx),
                    "y": int(cy),
                    "width": int(cw),
                    "height": int(ch),
                    "area_ratio": round(ar, 3)
                })
        return dark_regions

    def _detect_sections(self, gray, width):
        sections = []
        edges = cv2.Canny(gray, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 100, minLineLength=width // 3, maxLineGap=20)

        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                if abs(y2 - y1) < 5:
                    sections.append({
                        "y_position": int((y1 + y2) // 2),
                        "x_start": int(min(x1, x2)),
                        "x_end": int(max(x1, x2)),
                        "type": "horizontal_separator"
                    })

        sections.sort(key=lambda s: s["y_position"])
        return sections

    def _deduplicate_bars(self, bars, threshold=20):
        if not bars:
            return []
        unique = [bars[0]]
        for bar in bars[1:]:
            if not any(abs(bar.y - u.y) < threshold and abs(bar.x - u.x) < threshold for u in unique):
                unique.append(bar)
        return unique

    def _percent_to_level(self, pct: float) -> str:
        if pct >= 85:
            return "Expert"
        if pct >= 60:
            return "Avancé"
        if pct >= 40:
            return "Intermédiaire"
        return "Débutant"

    def _percent_to_score(self, pct: float) -> int:
        return min(100, max(0, int(pct)))
