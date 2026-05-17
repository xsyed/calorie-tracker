import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    minWidth: 64,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 16,
    color: '#007AFF',
  },
  backTextDark: {
    color: '#64A9FF',
  },
  titleGroup: {
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  dirtyText: {
    marginTop: 2,
    fontSize: 12,
    color: '#8E8E93',
  },
  dirtyTextDark: {
    color: '#B0B0B0',
  },
  saveButton: {
    minWidth: 64,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saveError: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateMessage: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  stateTitleDark: {
    color: '#FFFFFF',
  },
  stateBody: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  stateBodyDark: {
    color: '#B0B0B0',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalCard: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 12,
  },
  modalCardDark: {
    backgroundColor: '#1C1C1E',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
  },
  modalInput: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    color: '#000000',
    paddingHorizontal: 12,
  },
  modalInputDark: {
    borderColor: '#3A3A3C',
    color: '#FFFFFF',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
  },
  modalSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  modalPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default styles;
