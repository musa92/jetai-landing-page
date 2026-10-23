package custodian.ads_test

import data.custodian.ads
import rego.v1

features := {"id": "ad_features_v7", "status": "approved", "classification": "confidential", "region": "US", "allowed_purposes": ["model_training", "ads_personalization"], "sources": ["maps", "news"], "uses_idfa": true}

base := {"principal": {"sub": "svc-ad-gateway"}, "purpose": "ads_personalization", "dataset": features, "processing_region": "US", "grant": true}

test_fail_closed if not ads.allow with input as {"purpose": "ads_personalization"}

test_us_opted_in_allowed if ads.allow with input as object.union(base, {"user": {"eu": false, "gpc": false, "att": "authorized", "consent": {"ads_personalization": "granted"}}})

test_gpc_denied if not ads.allow with input as object.union(base, {"user": {"eu": false, "gpc": true, "att": "authorized", "consent": {"ads_personalization": "granted"}}})

test_eu_needs_opt_in if not ads.allow with input as object.union(base, {"processing_region": "EU", "user": {"eu": true, "gpc": false, "att": "authorized", "consent": {"ads_personalization": "unknown", "cross_service_combination": "granted"}}})

test_purpose_limitation if {
	not ads.allow with input as object.union(base, {"purpose": "analytics"})
}
