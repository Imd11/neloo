import pytest

from src.storage import signing


@pytest.fixture(autouse=True)
def _fixed_key(monkeypatch):
    monkeypatch.setenv("FILE_SECRET_KEY", "test-secret-32-bytes-xxxxxxxxxxxx")
    signing.get_file_secret_key.cache_clear()
    yield
    signing.get_file_secret_key.cache_clear()


def test_future_exp_valid():
    sig = signing.generate_url_signature("alice/x.csv", expires_in=3600)
    assert signing.verify_url_signature("alice/x.csv", sig) is True


def test_past_exp_invalid():
    sig = signing.generate_url_signature("alice/x.csv", expires_in=-10)
    assert signing.verify_url_signature("alice/x.csv", sig) is False


def test_tampered_file_id_invalid():
    sig = signing.generate_url_signature("alice/aaa", expires_in=3600)
    assert signing.verify_url_signature("bob/aaa", sig) is False


def test_legacy_sig_without_exp_rejected():
    # 旧格式（无 exp 分隔符）升级后判定无效——首次公开前无外部用户，可接受
    assert signing.verify_url_signature("alice/aaa", "deadbeefdeadbeef") is False


def test_file_and_image_storage_share_signing():
    # R1：file/image 两侧都应委托到 signing（DRY，不再有两份漂移的实现）
    from src.storage import file_storage, image_storage

    assert file_storage.generate_url_signature is signing.generate_url_signature
    assert image_storage.generate_url_signature is signing.generate_url_signature
