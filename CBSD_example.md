# Charge-Based Scaling Data (CBSD)

For an ability, entry `i` in `ChargeBasedScaling` is the charge-rate scalar used while `i` charges are stored. The array length equals the ability's maximum number of charges.

`AbilityName`, `ChargeCount`, and `ChargeBasedScaling` are contextual tooltip tokens supplied by the consumer for each ability; they are not stat properties in the database. In this example, the charge counts align by index with their charge-rate scalars:

{{AbilityName}} -> Threaded Needle
{{ChargeBasedScaling}} -> 0%|25%|50%
{{ChargeCount}} -> 0|1|2
