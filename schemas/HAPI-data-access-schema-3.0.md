HAPI 3.0 is a copy of 2.1.

`server-nodejs` handles 3.0 metadata (resolves references).

The schema needs to allow references and also check resolved metadata.

May need to revise all schema to have

````json
"patternProperties": {
    "x_.*": {
        "enum": ["number", "string", "boolean", "object", "array", "null"]
    }
}
```

instead of

````json
"patternProperties": {
    "x_.*": {}
}
```
