import { Component, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';
import { Button } from '@chpli2/ui';

interface Props extends WithTranslation {
  moduleKey: string;
  moduleUrl: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Shows a friendly error instead of a blank screen when a remote module
 * fails to load (e.g. its dev server is down).
 */
class RemoteErrorBoundaryInner extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: Props) {
    // Retry automatically when a different module is requested.
    if (prevProps.moduleKey !== this.props.moduleKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="remote-error" role="alert">
          <h2>{this.props.t('loadError.title')}</h2>
          <p>
            {this.props.t('loadError.message', {
              module: this.props.moduleKey,
              url: this.props.moduleUrl,
            })}
          </p>
          <Button variant="primary" onClick={() => this.setState({ hasError: false })}>
            {this.props.t('loadError.retry')}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const RemoteErrorBoundary = withTranslation()(RemoteErrorBoundaryInner);
export default RemoteErrorBoundary;
