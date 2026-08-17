"""In-memory image caches — port of `imageBuffers` in `server/routes.ts`."""

from __future__ import annotations

from collections import OrderedDict

MAX_BUFFER_ENTRIES = 500

_image_buffers: OrderedDict[int, bytes] = OrderedDict()


def set_image_buffer(image_id: int, buf: bytes) -> None:
    if image_id not in _image_buffers and len(_image_buffers) >= MAX_BUFFER_ENTRIES:
        _image_buffers.popitem(last=False)
    _image_buffers[image_id] = buf


def get_image_buffer(image_id: int) -> bytes | None:
    return _image_buffers.get(image_id)
