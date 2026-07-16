import { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({
        title: options.title || 'Are you sure?',
        message: options.message || 'This action cannot be undone.',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        danger: options.danger !== false,
        resolve,
      });
    });
  }, []);

  const handle = (result) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => handle(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className={`confirm-icon ${state.danger ? 'danger' : ''}`}>
              <AlertTriangle size={22} />
            </div>
            <h3>{state.title}</h3>
            <p>{state.message}</p>
            <div className="confirm-actions">
              <button type="button" className="btn btn-ghost" onClick={() => handle(false)}>
                {state.cancelText}
              </button>
              <button
                type="button"
                className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => handle(true)}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
