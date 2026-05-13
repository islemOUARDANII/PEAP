from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class SegmentTargetType(str, Enum):
    JOB_SEEKER = "JOB_SEEKER"
    EMPLOYER = "EMPLOYER"
    JOB_OFFER = "JOB_OFFER"


class SegmentOperator(str, Enum):
    EQ = "EQ"
    NEQ = "NEQ"
    IN = "IN"
    NOT_IN = "NOT_IN"
    GT = "GT"
    GTE = "GTE"
    LT = "LT"
    LTE = "LTE"
    CONTAINS = "CONTAINS"
    NOT_CONTAINS = "NOT_CONTAINS"
    EXISTS = "EXISTS"
    NOT_EXISTS = "NOT_EXISTS"


class SegmentLogic(str, Enum):
    AND = "AND"
    OR = "OR"


class SegmentBaseModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class SegmentRuleWriteRequest(SegmentBaseModel):
    target_type: SegmentTargetType
    attribute_path: str = Field(min_length=1)
    operator: SegmentOperator
    value: str = Field(min_length=1)
    logic: SegmentLogic = SegmentLogic.AND


class SegmentRuleCreateRequest(SegmentRuleWriteRequest):
    pass


class SegmentRuleUpdateRequest(SegmentRuleWriteRequest):
    pass


class SegmentRuleResponse(BaseModel):
    id: str
    target_type: SegmentTargetType
    attribute_path: str
    operator: SegmentOperator
    value: str
    logic: SegmentLogic


class SegmentWriteRequest(SegmentBaseModel):
    code: str = Field(min_length=1)
    label: str = Field(min_length=1)
    macro_segment: str | None = None
    priority: int = Field(default=100, ge=0)
    active: bool = True


class SegmentCreateRequest(SegmentWriteRequest):
    pass


class SegmentUpdateRequest(SegmentWriteRequest):
    pass


class SegmentListItemResponse(BaseModel):
    id: str
    code: str
    label: str
    macro_segment: str | None = None
    priority: int
    active: bool


class SegmentResponse(SegmentListItemResponse):
    rules: list[SegmentRuleResponse] = Field(default_factory=list)
