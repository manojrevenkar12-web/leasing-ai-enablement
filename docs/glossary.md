# Leasing glossary

Terms as this codebase uses them. Agents get these through the MCP server (`leasing_glossary`).

## Leasingfaktor (leasing factor)
The monthly rate as a percentage of the list price: `rate / list price × 100`, two decimals. Lower is
cheaper. Compared like for like: gross rate to gross price for private customers, net rate to net
price for business customers. Column `offers.leasing_factor`.

## Gesamtkostenfaktor (total cost factor)
Like the leasing factor, but the down payment and the one-off costs (transfer, registration) are
spread over the term first: `(rate × months + down payment + one-off costs) / months / list price × 100`.
The honest number to compare offers with a down payment. Column `offers.total_cost_factor`.

## Sonderzahlung (down payment)
A one-off payment at the start that lowers the monthly rate. `down_payment_cents`, gross.
Online quotes allow at most half the list price.

## Überführungskosten / Zulassungskosten (transfer and registration costs)
One-off costs to deliver and register the car. Stored together as `extra_costs_cents`, gross. They
do not change the monthly rate, only the total cost factor.

## Restwert (residual value)
What the car is expected to be worth at the end of the term, in % of the list price, by segment,
term and mileage (`config/leasing.php`). The rate pays off the price down to the residual value.

## Kilometerleasing (mileage leasing)
The contract fixes the kilometres per year (10,000, 15,000, 20,000 or 30,000). More kilometres mean a
lower residual value and a higher rate. Other mileages are rejected (approved change AC-2).

## Privatleasing / Gewerbeleasing (private / business leasing)
Private customers see gross prices (incl. 19% VAT); business customers see net prices. Business
factors compare net to net (approved change AC-1).

## Laufzeit (term)
24, 36, 48 or 60 months.

## Golden master
`apps/api/tests/GoldenMaster/legacy-quotes.json`: 10,240 quotes recorded from the legacy calculator
before it was replaced. The new calculator must reproduce them, except where an approved change in
`approved-changes.json` says otherwise. Never re-recorded to make a test pass.
