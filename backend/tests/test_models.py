import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import json
from fastapi.testclient import TestClient
from app.main import app
from app.classifier import (
    DEFAULT_GEMINI_MODELS,
    get_selected_model,
    set_selected_model,
    get_available_gemini_models,
    classify_batch_with_gemini
)

client = TestClient(app)

def test_default_models_endpoint():
    response = client.get('/api/gemini-models/default')
    assert response.status_code == 200
    data = response.json()
    assert 'models' in data
    assert len(data['models']) >= 5
    assert 'selected_model' in data
    model_ids = [m['id'] for m in data['models']]
    assert 'gemini-2.5-flash' in model_ids
    assert 'gemini-2.5-pro' in model_ids
    print('[OK] test_default_models_endpoint passed')

def test_get_and_set_model_endpoint():
    res_set = client.post('/api/model', json={'model': 'gemini-2.5-pro'})
    assert res_set.status_code == 200
    assert res_set.json()['selected_model'] == 'gemini-2.5-pro'

    res_get = client.get('/api/model')
    assert res_get.status_code == 200
    assert res_get.json()['selected_model'] == 'gemini-2.5-pro'

    set_selected_model('gemini-2.5-flash')
    assert get_selected_model() == 'gemini-2.5-flash'
    print('[OK] test_get_and_set_model_endpoint passed')

def test_gemini_models_key_endpoint_fallback():
    res = client.post('/api/gemini-models', json={'api_key': ''})
    assert res.status_code == 200
    data = res.json()
    assert len(data['models']) >= 5
    print('[OK] test_gemini_models_key_endpoint_fallback passed')

def test_test_gemini_key_validation():
    res = client.post('/api/test-gemini-key', json={'api_key': 'short'})
    assert res.status_code == 400

    res_invalid = client.post('/api/test-gemini-key', json={'api_key': 'AIzaSyFakeKeyInvalid1234567890'})
    assert res_invalid.status_code == 400
    print('[OK] test_test_gemini_key_validation passed')

def test_classifier_model_fallback():
    res, model_used = classify_batch_with_gemini([], '')
    assert res == {}
    assert model_used == ''

    res, model_used = classify_batch_with_gemini(['Funcion Rara No Registrada 123'], 'fake_api_key_12345', model='gemini-2.5-pro')
    assert 'Funcion Rara No Registrada 123' in res
    assert res['Funcion Rara No Registrada 123'] == 'AULA'
    print('[OK] test_classifier_model_fallback passed')

if __name__ == '__main__':
    test_default_models_endpoint()
    test_get_and_set_model_endpoint()
    test_gemini_models_key_endpoint_fallback()
    test_test_gemini_key_validation()
    test_classifier_model_fallback()
    print('\n>>> [SUCCESS] All backend model tests passed! <<<')
