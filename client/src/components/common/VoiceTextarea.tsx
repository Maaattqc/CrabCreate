import { useCallback, useRef, forwardRef } from 'react';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import MicButton from './MicButton';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

interface VoiceTextareaProps extends TextareaProps {
  containerClassName?: string;
}

const VoiceTextarea = forwardRef<HTMLTextAreaElement, VoiceTextareaProps>(
  ({ containerClassName = '', className = '', onChange, value, ...rest }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);

    const handleTranscript = useCallback(
      (text: string, isFinal: boolean) => {
        if (!isFinal || !onChange) return;
        const currentValue = typeof value === 'string' ? value : '';
        const newValue = currentValue ? `${currentValue} ${text}` : text;
        const syntheticEvent = {
          target: { value: newValue },
        } as React.ChangeEvent<HTMLTextAreaElement>;
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
        <textarea
          ref={(node) => {
            (internalRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
          }}
          value={value}
          onChange={onChange}
          className={`${className} ${isSupported ? 'pr-8' : ''}`}
          {...rest}
        />
        <div className="absolute right-1.5 top-2">
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

VoiceTextarea.displayName = 'VoiceTextarea';
export default VoiceTextarea;
