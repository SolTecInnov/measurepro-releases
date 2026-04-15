import { describe, it, expect, beforeEach } from 'vitest';
import { useAlertsStore } from '../alertsStore';

describe('useAlertsStore', () => {
  beforeEach(() => {
    useAlertsStore.setState({
      alertStatus: null,
      triggerValue: null,
    });
  });

  it('has correct defaults', () => {
    const state = useAlertsStore.getState();
    expect(state.alertStatus).toBeNull();
    expect(state.triggerValue).toBeNull();
  });

  it('setAlertStatus("warning") sets alertStatus to warning', () => {
    useAlertsStore.getState().setAlertStatus('warning');
    expect(useAlertsStore.getState().alertStatus).toBe('warning');
  });

  it('setAlertStatus("critical") sets alertStatus to critical', () => {
    useAlertsStore.getState().setAlertStatus('critical');
    expect(useAlertsStore.getState().alertStatus).toBe('critical');
  });

  it('setTriggerValue(3.5) sets triggerValue', () => {
    useAlertsStore.getState().setTriggerValue(3.5);
    expect(useAlertsStore.getState().triggerValue).toBe(3.5);
  });

  it('clearAlert() resets both to null', () => {
    useAlertsStore.getState().setAlertStatus('critical');
    useAlertsStore.getState().setTriggerValue(3.5);
    useAlertsStore.getState().clearAlert();
    const state = useAlertsStore.getState();
    expect(state.alertStatus).toBeNull();
    expect(state.triggerValue).toBeNull();
  });

  it('setAlertStatus(null) clears status', () => {
    useAlertsStore.getState().setAlertStatus('warning');
    useAlertsStore.getState().setAlertStatus(null);
    expect(useAlertsStore.getState().alertStatus).toBeNull();
  });
});
