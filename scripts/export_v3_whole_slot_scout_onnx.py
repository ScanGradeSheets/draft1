#!/usr/bin/env python3
"""Export the key-blind larger-grayscale slot/metadata scout to ONNX."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch

from evaluate_v3_slot_crop_metadata_crossfit import (
    HEIGHT,
    METADATA_DIM,
    SLOT_WIDTH,
    SlotCropMetadataNet,
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument(
        "--base-checkpoint",
        type=Path,
        default=Path("private-evidence/models/v3-sequence-synthetic-seed17/model.pt"),
    )
    parser.add_argument("--onnx-out", type=Path, required=True)
    parser.add_argument("--metadata-out", type=Path, required=True)
    return parser.parse_args()


def main():
    opts = parse_args()
    checkpoint = torch.load(opts.checkpoint, map_location="cpu", weights_only=True)
    base_checkpoint = torch.load(opts.base_checkpoint, map_location="cpu", weights_only=True)
    model = SlotCropMetadataNet(
        base_checkpoint["state_dict"],
        bool(checkpoint.get("includeWholeResidual")),
    )
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    opts.onnx_out.parent.mkdir(parents=True, exist_ok=True)
    dummy = (
        torch.zeros(1, 1, HEIGHT, SLOT_WIDTH * 2),
        torch.zeros(1, 1, HEIGHT, SLOT_WIDTH),
        torch.zeros(1, 1, HEIGHT, SLOT_WIDTH),
        torch.zeros(1, METADATA_DIM),
    )
    torch.onnx.export(
        model,
        dummy,
        opts.onnx_out,
        input_names=["whole", "left", "right", "metadata"],
        output_names=["length", "tens", "ones", "left_slot", "right_slot"],
        dynamic_axes={
            "whole": {0: "batch"},
            "left": {0: "batch"},
            "right": {0: "batch"},
            "metadata": {0: "batch"},
            "length": {0: "batch"},
            "tens": {0: "batch"},
            "ones": {0: "batch"},
            "left_slot": {0: "batch"},
            "right_slot": {0: "batch"},
        },
        opset_version=17,
        dynamo=False,
    )
    metadata = {
        "schemaVersion": 1,
        "purpose": "Key-blind suspicious-accepted-answer routing scout; never grades or auto-corrects.",
        "height": HEIGHT,
        "slotWidth": SLOT_WIDTH,
        "metadata": [
            "one physical slot",
            "two physical slots",
            "row layout",
            "number-bond layout",
            "other non-row layout",
        ],
        "selectedDecoder": checkpoint.get("selectedDecoder"),
        "heldOutPacket": checkpoint.get("heldOutPacket"),
        "trainingPackets": checkpoint.get("trainingPackets"),
        "answerKeyProvidedToModel": bool(checkpoint.get("answerKeyProvidedToModel")),
        "includeWholeResidual": bool(checkpoint.get("includeWholeResidual")),
    }
    opts.metadata_out.write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps({
        "onnx": str(opts.onnx_out),
        "bytes": opts.onnx_out.stat().st_size,
        "metadata": metadata,
    }, indent=2))


if __name__ == "__main__":
    main()
