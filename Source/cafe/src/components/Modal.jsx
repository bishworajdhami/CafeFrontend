import React from 'react';
import ReactDOM from 'react-dom';
import './Modal.css';

const Modal = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    type = 'primary',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    showCancel = true,
    showInput = false,
    inputValue = '',
    onInputChange,
    inputPlaceholder = 'Type here...',
    validationText = null,
    size = 'medium' // 'small', 'medium', 'large'
}) => {
    if (!isOpen) return null;

    const handleConfirm = () => {
        if (validationText && inputValue !== validationText) return;
        onConfirm(inputValue);
    };

    const isConfirmDisabled = validationText && inputValue !== validationText;

    return ReactDOM.createPortal(
        <div className="modal-overlay">
            <div className={`modal-container modal-${type} modal-${size}`}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="modal-close" onClick={onCancel}>&times;</button>
                </div>
                <div className="modal-body">
                    <p>{message}</p>
                    {showInput && (
                        <div className="modal-input-container">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => onInputChange(e.target.value)}
                                placeholder={inputPlaceholder}
                                autoFocus
                            />
                            {validationText && (
                                <p className="modal-validation-hint">
                                    Type <strong>{validationText}</strong> to confirm
                                </p>
                            )}
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    {showCancel && (
                        <button className="modal-btn modal-btn-secondary" onClick={onCancel}>
                            {cancelText}
                        </button>
                    )}
                    <button
                        className={`modal-btn modal-btn-${type}`}
                        onClick={handleConfirm}
                        disabled={isConfirmDisabled}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
