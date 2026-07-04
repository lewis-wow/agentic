# `Flag.key` is immutable after creation

Only `Flag.name` (the display label) can be renamed; `key` is fixed for the life of the flag. SDKs cache and evaluate flags by `key`, and it appears in customer code (`isEnabled('my-flag-key')`) — allowing it to change would silently break every integration referencing the old value, with no way for the SDK to detect the rename. A typical CRUD entity would let you rename any field, which is why this is called out explicitly rather than left to be discovered by surprise.
