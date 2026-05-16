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
});

export default styles;
