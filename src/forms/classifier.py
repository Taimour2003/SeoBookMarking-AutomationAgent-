import re


FIELD_KEYWORDS = {
    "title": (
        "title",
        "bookmark title",
        "headline",
        "post title",
    ),
    "website_url": (
        "url",
        "website",
        "website url",
        "link",
        "bookmark url",
    ),
    "short_description": (
        "short description",
        "summary",
        "excerpt",
        "brief description",
        "meta description",
    ),

    "long_description": (
        "long description",
        "description",
        "content",
        "article",
        "details",
        "body",
        "about",
    ),

    "category": (
        "category",
        "topic",
        "section",
        "industry",
        "business type",
    ),

    "tags": (
        "tags",
        "keywords",
        "labels",
    ),

    "company_name": (
        "company",
        "company name",
        "business name",
        "organization",
    ),
}


def normalize_text(
    value: str | None,
) -> str:
    if not value:
        return ""

    return re.sub(
        r"\s+",
        " ",
        value,
    ).strip().lower()


def classify_field(
    field: dict,
) -> tuple[str | None, int]:
    input_type = normalize_text(
        field.get("inputType")
    )

    if input_type == "url":
        return "website_url", 99

    combined = " ".join(
        [
            normalize_text(
                field.get("label")
            ),
            normalize_text(
                field.get("name")
            ),
            normalize_text(
                field.get("placehoklder")
            ),
        ]
    )

    best_field = None
    best_score = 0

    for logical_field, keywords in (
        FIELD_KEYWORDS.items()
    ):
        for keyword in keywords:
            keyword = normalize_text(keyword)

            if combined == keyword:
                score = 98

            elif keyword in combined:
                score = 88

            else:
                continue

            if score > best_score:
                best_score = score
                best_field = logical_field

    return best_field, best_score