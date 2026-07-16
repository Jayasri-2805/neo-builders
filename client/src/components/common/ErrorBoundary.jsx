import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console for now; could send to server
    console.error('ErrorBoundary caught', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="modal-overlay" onClick={() => this.setState({ hasError: false, error: null })}>
          <div className="modal-panel modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Something went wrong</h3>
            </div>
            <div className="modal-body">
              <p>An unexpected error occurred while rendering this form.</p>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error)}</pre>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => this.setState({ hasError: false, error: null })}>Close</button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
