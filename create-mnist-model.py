#!/usr/bin/env python3
"""
LEGACY / DEBUG ONLY:
Create a random-weight MNIST-shaped ONNX model for pipeline smoke tests.

This script does NOT train a model and should not be used for production OCR quality.
Use scripts/train_worksheet_digits.py for a real trained worksheet model.
"""

import numpy as np
import onnx
from onnx import helper, TensorProto

def create_mnist_model():
    """Create a random-weight 2-layer MLP for debug-only testing."""
    
    np.random.seed(42)
    
    # Layer 1: 784 -> 128
    W1 = np.random.randn(784, 128).astype(np.float32) * 0.1
    b1 = np.zeros(128, dtype=np.float32)
    
    # Layer 2: 128 -> 10
    W2 = np.random.randn(128, 10).astype(np.float32) * 0.1
    b2 = np.zeros(10, dtype=np.float32)
    
    # Create initializers
    W1_init = helper.make_tensor(
        name='W1',
        data_type=TensorProto.FLOAT,
        dims=W1.shape,
        vals=W1.flatten().tolist()
    )
    
    b1_init = helper.make_tensor(
        name='b1',
        data_type=TensorProto.FLOAT,
        dims=b1.shape,
        vals=b1.tolist()
    )
    
    W2_init = helper.make_tensor(
        name='W2',
        data_type=TensorProto.FLOAT,
        dims=W2.shape,
        vals=W2.flatten().tolist()
    )
    
    b2_init = helper.make_tensor(
        name='b2',
        data_type=TensorProto.FLOAT,
        dims=b2.shape,
        vals=b2.tolist()
    )
    
    # Create nodes: Flatten [1,1,28,28] -> [1, 784] then MatMul
    flatten = helper.make_node(
        'Flatten',
        inputs=['input'],
        outputs=['flat'],
        name='Flatten',
        axis=1
    )
    matmul1 = helper.make_node(
        'MatMul',
        inputs=['flat', 'W1'],
        outputs=['matmul1'],
        name='MatMul1'
    )
    
    add1 = helper.make_node(
        'Add',
        inputs=['matmul1', 'b1'],
        outputs=['hidden_pre'],
        name='Add1'
    )
    
    relu1 = helper.make_node(
        'Relu',
        inputs=['hidden_pre'],
        outputs=['hidden'],
        name='Relu1'
    )
    
    matmul2 = helper.make_node(
        'MatMul',
        inputs=['hidden', 'W2'],
        outputs=['matmul2'],
        name='MatMul2'
    )
    
    add2 = helper.make_node(
        'Add',
        inputs=['matmul2', 'b2'],
        outputs=['output'],
        name='Add2'
    )
    
    # Create graph with correct API
    graph = helper.make_graph(
        nodes=[
            flatten, matmul1, add1, relu1,
            matmul2, add2
        ],
        name='mnist-digit-recognition',
        inputs=[
            helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 1, 28, 28])
        ],
        outputs=[
            helper.make_tensor_value_info('output', TensorProto.FLOAT, [1, 10])
        ],
        initializer=[W1_init, b1_init, W2_init, b2_init]
    )
    
    # Create model
    model = helper.make_model(
        graph,
        opset_imports=[helper.make_operatorsetid('', 13)]
    )
    
    # Validate and save
    onnx.checker.check_model(model)
    import os
    out_dir = os.path.join(os.path.dirname(__file__), 'public', 'models')
    os.makedirs(out_dir, exist_ok=True)
    onnx.save(model, os.path.join(out_dir, 'mnist-model.onnx'))
    
    print('⚠️ Legacy debug model created: public/models/mnist-model.onnx')
    print('   This model has random weights and is NOT production quality.')
    print(f'   Input: [1, 1, 28, 28]')
    print(f'   Output: [1, 10] (digit probabilities)')

if __name__ == '__main__':
    create_mnist_model()
