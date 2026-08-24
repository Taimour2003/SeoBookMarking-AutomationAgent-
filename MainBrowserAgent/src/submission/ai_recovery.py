from __future__ import annotations

from forms.filler import fill_fields


async def apply_ai_patch(
    *,
    page,
    patch: dict,
    mappings: list[dict],
    current_data: dict,
) -> dict:
    changes = patch.get(
        "changes",
        {},
    )

    updated_data = dict(
        current_data
    )

    changed_fields = []

    for logical_field, change in (
        changes.items()
    ):
        updated_data[logical_field] = (
            change["new_value"]
        )

        changed_fields.append(
            logical_field
        )

    relevant_mappings = [
        mapping
        for mapping in mappings
        if mapping.get("logical_field")
        in changed_fields
    ]

    fill_result = await fill_fields(
        page=page,
        mappings=relevant_mappings,
        data=updated_data,
    )

    return {
        "success": not fill_result[
            "failed_fields"
        ],
        "updated_data": updated_data,
        "changed_fields": changed_fields,
        "fill_result": fill_result,
    }