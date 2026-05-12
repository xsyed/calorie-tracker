import { StyleSheet } from 'react-native';

export const sharedStyles = StyleSheet.create({
  label: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 24,
  },
  labelDark: {
    color: '#FFFFFF',
  },

  error: {
    marginTop: 12,
    fontSize: 14,
    color: '#CC0000',
  },
  errorDark: {
    color: '#FF4444',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 32,
    fontWeight: '600',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 56,
  },
  inputLight: {
    backgroundColor: '#F5F5F5',
    color: '#000000',
  },
  inputDark: {
    backgroundColor: '#1C1C1E',
    color: '#FFFFFF',
  },
  inputError: {
    borderWidth: 2,
    borderColor: '#CC0000',
  },
  unit: {
    fontSize: 18,
    color: '#666666',
  },
  unitDark: {
    color: '#AAAAAA',
  },

  option: {
    minHeight: 56,
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 2,
  },
  optionLight: {
    borderColor: '#CCCCCC',
    backgroundColor: 'transparent',
  },
  optionDark: {
    borderColor: '#444444',
    backgroundColor: 'transparent',
  },
  optionSelectedLight: {
    borderColor: '#000000',
    backgroundColor: '#000000',
  },
  optionSelectedDark: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  optionText: {
    fontSize: 18,
    fontWeight: '500' as const,
  },
  optionTextLight: {
    color: '#000000',
  },
  optionTextDark: {
    color: '#FFFFFF',
  },
  optionTextSelectedLight: {
    color: '#FFFFFF',
  },
  optionTextSelectedDark: {
    color: '#000000',
  },

  button: {
    minHeight: 50,
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  buttonPrimary: {
    borderWidth: 0,
  },
  buttonPrimaryLight: {
    backgroundColor: '#000000',
  },
  buttonPrimaryDark: {
    backgroundColor: '#FFFFFF',
  },
  buttonSecondaryLight: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#CCCCCC',
  },
  buttonSecondaryDark: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#444444',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  buttonTextSecondaryLight: {
    color: '#FFFFFF',
  },
  buttonTextSecondaryDark: {
    color: '#000000',
  },
  buttonTextDark: {
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  hint: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  hintDark: {
    color: '#AAAAAA',
  },
});
