function plural(v) {
    return v > 1 || v == 0 ? "s" : "";
}
module.exports.plural = plural;
