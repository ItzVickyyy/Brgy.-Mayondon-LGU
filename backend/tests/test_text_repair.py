from app.core.text_repair import fix_mojibake


def test_repairs_utf8_read_as_windows_1252() -> None:
    assert fix_mojibake("Los BaÃ±os") == "Los Baños"
    assert fix_mojibake("PeÃ±a, Los BaÃ±os, Laguna") == "Peña, Los Baños, Laguna"


def test_leaves_good_text_alone() -> None:
    assert fix_mojibake("Los Baños") == "Los Baños"
    assert fix_mojibake("Plain text") == "Plain text"
    assert fix_mojibake("Ã") == "Ã"
