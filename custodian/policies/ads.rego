# Custodian ads policy bundle, version ads-1.4.0 (live).
# Decision document: { allow, reasons[], version }. Enforcement happens in each
# service (PEP); this bundle only decides (PDP). js/engine.js mirrors it rule
# for rule so the hosted demo runs without an OPA server.
package custodian.ads

import rego.v1

version := "ads-1.4.0"

default allow := false

allow if count(deny) == 0

required := {"principal", "purpose", "dataset", "processing_region"}

# Fail closed: any missing required input is a denial.
deny contains {"code": "missing_input", "field": f} if {
	some f in required
	not input[f]
}

deny contains {"code": "dataset_not_approved"} if input.dataset.status != "approved"

# GDPR Art. 5(1)(b): purpose limitation.
deny contains {"code": "purpose_not_permitted"} if {
	not input.purpose in input.dataset.allowed_purposes
}

# Restricted data (precise location, raw device IDs) never feeds ads.
deny contains {"code": "restricted_for_ads"} if {
	input.purpose == "ads_personalization"
	input.dataset.classification == "restricted"
}

# GDPR Art. 44-46: EU data stays in the EU without a transfer basis.
deny contains {"code": "eu_transfer_blocked"} if {
	input.dataset.region == "EU"
	input.processing_region != "EU"
	not input.transfer_basis
}

deny contains {"code": "no_active_grant"} if input.grant == false

# GDPR Art. 6(1)(a): EU personalization requires opt-in.
deny contains {"code": "gdpr_no_opt_in"} if {
	input.purpose == "ads_personalization"
	input.user.eu
	input.user.consent.ads_personalization != "granted"
}

# CCPA 1798.120 / 1798.135: GPC is an opt-out of sharing.
deny contains {"code": "gpc_signal"} if {
	input.purpose == "ads_personalization"
	not input.user.eu
	input.user.gpc
}

deny contains {"code": "ccpa_opt_out"} if {
	input.purpose == "ads_personalization"
	not input.user.eu
	not input.user.gpc
	input.user.consent.ads_personalization == "denied"
}

# DMA Art. 5(2): cross-service combination needs explicit consent.
deny contains {"code": "dma_no_combination_consent"} if {
	input.purpose == "ads_personalization"
	input.user.eu
	count(input.dataset.sources) > 1
	input.user.consent.cross_service_combination != "granted"
}

# Platform tracking authorization gates the advertising identifier.
deny contains {"code": "att_denied"} if {
	input.dataset.uses_idfa
	input.user
	input.user.att != "authorized"
}
