import pytest
from backend.utils.emergency import detect_emergency

def test_burst_pipe_detected():
    is_emergency, keyword = detect_emergency("I have a burst pipe in the basement")
    assert is_emergency is True
    assert keyword == "burst pipe"

def test_gas_leak_detected():
    is_emergency, keyword = detect_emergency("smell gas in the kitchen")
    assert is_emergency is True
    assert keyword == "smell gas"

def test_no_heat_detected():
    is_emergency, keyword = detect_emergency("no heat in the entire house")
    assert is_emergency is True
    assert keyword == "no heat"

def test_sparking_detected():
    is_emergency, keyword = detect_emergency("the outlet is sparking")
    assert is_emergency is True
    assert keyword == "sparking"

def test_uppercase_input():
    is_emergency, keyword = detect_emergency("THERE IS A BURST PIPE")
    assert is_emergency is True
    assert keyword == "burst pipe"

def test_no_emergency_normal_call():
    is_emergency, keyword = detect_emergency("I need a quote for a new sink")
    assert is_emergency is False
    assert keyword is None

def test_empty_string():
    is_emergency, keyword = detect_emergency("")
    assert is_emergency is False
    assert keyword is None

def test_none_input():
    is_emergency, keyword = detect_emergency(None)
    assert is_emergency is False
    assert keyword is None
