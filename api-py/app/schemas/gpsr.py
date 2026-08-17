"""GPSR identity request/response DTOs. camelCase for the SPA."""

from app.schemas.base import CamelModel


class GpsrPartyIn(CamelModel):
    name: str = ""
    postal_address: str = ""
    email: str = ""


class GpsrIdentityIn(CamelModel):
    manufacturer: GpsrPartyIn
    manufacturer_in_eu: bool = False
    eu_responsible_person: GpsrPartyIn | None = None
