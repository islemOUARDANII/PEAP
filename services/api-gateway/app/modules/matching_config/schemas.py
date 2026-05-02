from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MatchingDirection(str, Enum):
    CANDIDATE_TO_OFFER = "CANDIDATE_TO_OFFER"
    OFFER_TO_CANDIDATE = "OFFER_TO_CANDIDATE"
    CANDIDATE_TO_OCCUPATION = "CANDIDATE_TO_OCCUPATION"


class MatchingVersionStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class MatchingCriterionDataType(str, Enum):
    TEXT = "TEXT"
    NUMBER = "NUMBER"
    BOOLEAN = "BOOLEAN"
    DATE = "DATE"
    CODE = "CODE"
    CODE_LIST = "CODE_LIST"
    GEO = "GEO"
    JSON = "JSON"


class MatchingLogicOperator(str, Enum):
    AND = "AND"
    OR = "OR"


class MatchingRuleOperator(str, Enum):
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
    DISTANCE_LTE = "DISTANCE_LTE"


class MatchingBaseModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class MatchingCriterionWriteRequest(MatchingBaseModel):
    code: str = Field(min_length=1)
    label: str = Field(min_length=1)
    description: str | None = None
    data_type: MatchingCriterionDataType
    active: bool = True


class MatchingCriterionCreateRequest(MatchingCriterionWriteRequest):
    pass


class MatchingCriterionUpdateRequest(MatchingCriterionWriteRequest):
    pass


class MatchingCriterionResponse(BaseModel):
    id: str
    code: str
    label: str
    description: str | None = None
    data_type: MatchingCriterionDataType
    active: bool


class MatchingModelCriterionWriteRequest(MatchingBaseModel):
    criterion_id: UUID
    weight: float = Field(ge=0)
    is_must: bool = False
    min_threshold: float | None = Field(default=None, ge=0)
    logic_operator: MatchingLogicOperator = MatchingLogicOperator.AND


class MatchingModelCriterionCreateRequest(MatchingModelCriterionWriteRequest):
    pass


class MatchingModelCriterionUpdateRequest(MatchingModelCriterionWriteRequest):
    pass


class MatchingModelCriterionResponse(BaseModel):
    id: str
    criterion_id: str
    criterion_code: str
    criterion_label: str
    data_type: MatchingCriterionDataType
    weight: float
    is_must: bool
    min_threshold: float | None = None
    logic_operator: MatchingLogicOperator


class MatchingHardFilterWriteRequest(MatchingBaseModel):
    criterion_id: UUID
    rule_operator: MatchingRuleOperator
    rule_value: str = Field(min_length=1)
    rejection_reason: str | None = None


class MatchingHardFilterCreateRequest(MatchingHardFilterWriteRequest):
    pass


class MatchingHardFilterUpdateRequest(MatchingHardFilterWriteRequest):
    pass


class MatchingHardFilterResponse(BaseModel):
    id: str
    criterion_id: str
    criterion_code: str
    criterion_label: str
    rule_operator: MatchingRuleOperator
    rule_value: str
    rejection_reason: str | None = None


class MatchingModelVersionCreateRequest(MatchingBaseModel):
    version_number: int | None = Field(default=None, gt=0)


class MatchingModelVersionUpdateRequest(MatchingBaseModel):
    version_number: int = Field(gt=0)


class MatchingModelVersionResponse(BaseModel):
    id: str
    version_number: int
    status: MatchingVersionStatus
    created_at: datetime
    published_at: datetime | None = None
    criteria: list[MatchingModelCriterionResponse] = Field(default_factory=list)
    hard_filters: list[MatchingHardFilterResponse] = Field(default_factory=list)


class MatchingModelWriteRequest(MatchingBaseModel):
    code: str = Field(min_length=1)
    label: str = Field(min_length=1)
    direction: MatchingDirection
    description: str | None = None
    active: bool = True


class MatchingModelCreateRequest(MatchingModelWriteRequest):
    pass


class MatchingModelUpdateRequest(MatchingModelWriteRequest):
    pass


class MatchingModelResponse(BaseModel):
    id: str
    code: str
    label: str
    direction: MatchingDirection
    description: str | None = None
    active: bool
    versions: list[MatchingModelVersionResponse] = Field(default_factory=list)
