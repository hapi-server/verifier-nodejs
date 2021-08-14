The `HAPI 3.1` schema has the proposed `encoding` element. The `TestData3.1` server has datasets and parameters with Unicode, which have always been allowed. The change in `3.1` is to allow string data to be Unicode encoded as UTF-8. The `TestData3.1` server also serves parameters with Unicode.

As written, `encoding` is allowed for any of `type=`, `string`, `isotime`, `integer`, and `double`. It should only be allowed for `type=string`.

This could be implemented by using `anyOf`

```json
"anyOf":
    [
        {
            "type": {
                "description": "Parameter type",
                "type": "string",
                "enum": ["isotime","integer","double"]
            }
        },
        {
            "type": {
                "description": "Parameter type",
                "type": "string",
                "enum": ["string"]
            },
            "encoding": {
                "description": "String encoding",
                "type": "string",
                "enum": ["ascii","utf-8"]
            }
        }
    ]
```

However, in this case we would need to set `"additionalProperties": true`. See https://json-schema.org/understanding-json-schema/reference/object.html

Note that this issue could be resolved using `if/then/else` in Draft 7 of JSON Schema https://json-schema.org/understanding-json-schema/reference/conditionals.html
