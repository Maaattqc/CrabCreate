import { useCallback, useRef, forwardRef } from 'react';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import MicButton from './MicButton';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

interface VoiceInputProps extends InputProps {
  containerClassName?: string;
}

const VoiceInput = forwardRef<HTMLInputElement, VoiceInputProps>(
  ({ containerClassName = '', className = '', onChange, value, ...rest }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);

    const handleTranscript = useCallback(
      (text: string, isFinal: boolean) => {
        if (!isFinal || !onChange) return;
        const currentValue = typeof value === 'string' ? value : '';
        const newValue = currentValue ? `${currentValue} ${text}` : text;
        const syntheticEvent = {
          target: { value: newValue },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      },
      [onChange, value],
    );

    const { isListening, isSupported, toggle } = useSpeechToText({
      onTranscript: handleTranscript,
    });

    const handleMicClick = useCallback(() => {
      internalRef.current?.focus();
      toggle();
    }, [toggle]);

    return (
      <div className={`relative ${containerClassName}`}>
        <input
          ref={(node) => {
            (internalRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
          }}
          value={value}
          onChange={onChange}
          className={`${className} ${isSupported ? 'pr-8' : ''}`}
          {...rest}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
          <MicButton
            isListening={isListening}
            isSupported={isSupported}
            onClick={handleMicClick}
            size={14}
          />
        </div>
      </div>
    );
  },
);

VoiceInput.displayName = 'VoiceInput';
export default VoiceInput;
