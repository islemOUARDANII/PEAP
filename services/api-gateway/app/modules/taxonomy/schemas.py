from pydantic import BaseModel


class TaxonomyNodeResponse(BaseModel):
    id: str
    node_type: str
    source: str | None = None
    source_code: str | None = None
    label: str
    active: bool
    extra_json: dict | list | str | int | float | bool | None = None
