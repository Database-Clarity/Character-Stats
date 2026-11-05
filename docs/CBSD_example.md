# Charge-Based Scaling Data (CBSD)

For an ability, entry `i` in `ChargeBasedScaling` is the charge-rate scalar used while `i` charges are stored. The array length equals the ability's maximum number of charges.

`AbilityName`, `ChargeCount`, and `ChargeBasedScaling` are contextual tooltip tokens supplied by the consumer for each ability; they are not stat properties in the database. The `ChargeList` formatter marks the per-charge list format: each scalar is shown as its increase over the base rate, and the values are joined with `|` so that charge counts align by index with their increases. For `ChargeBasedScaling: [1, 1.25, 1.5]`:

{{AbilityName}} -> Threaded Needle
{{ChargeBasedScaling|ChargeList}} -> 0%|25%|50%
{{ChargeCount|ChargeList}} -> 0|1|2

The bare `{{ChargeBasedScaling}}` and `{{ChargeCount}}` tokens are still accepted and render the same way. Core `formatChargeList` produces both strings.
