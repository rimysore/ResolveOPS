from .domain import Asset, TenantPolicy

TENANT_POLICIES: dict[str, TenantPolicy] = {
    "iu-facilities": TenantPolicy(
        tenant_id="iu-facilities",
        name="IU Facilities",
        approval_threshold=5_000,
        emergency_keywords=("smoke", "flood", "electrical", "no cooling", "gas"),
        replacement_age_years=12,
    ),
    "meridian-health": TenantPolicy(
        tenant_id="meridian-health",
        name="Meridian Health",
        approval_threshold=0,
        emergency_keywords=("patient", "oxygen", "sterile", "outage", "leak"),
        replacement_age_years=8,
        require_all_actions_approved=True,
        minimum_confidence=0.82,
    ),
    "northstar-mfg": TenantPolicy(
        tenant_id="northstar-mfg",
        name="Northstar Manufacturing",
        approval_threshold=12_000,
        emergency_keywords=("line stopped", "safety", "overheat", "pressure", "fire"),
        replacement_age_years=10,
        minimum_confidence=0.76,
    ),
}


ASSETS: dict[str, Asset] = {
    "ahu-bio-214": Asset(
        asset_id="ahu-bio-214",
        name="Biology 214 Air Handler",
        category="HVAC",
        age_years=14,
        replacement_cost=18_500,
        repair_count_12m=4,
        criticality=7,
    ),
    "pump-icu-07": Asset(
        asset_id="pump-icu-07",
        name="ICU Chilled Water Pump 07",
        category="HVAC",
        age_years=6,
        replacement_cost=28_000,
        repair_count_12m=1,
        criticality=10,
        warranty_active=True,
    ),
    "press-line-3": Asset(
        asset_id="press-line-3",
        name="Hydraulic Press Line 3",
        category="Production",
        age_years=11,
        replacement_cost=74_000,
        repair_count_12m=5,
        criticality=9,
    ),
    "generator-lib-1": Asset(
        asset_id="generator-lib-1",
        name="Library Backup Generator",
        category="Electrical",
        age_years=5,
        replacement_cost=41_000,
        repair_count_12m=0,
        criticality=8,
        warranty_active=True,
    ),
}
