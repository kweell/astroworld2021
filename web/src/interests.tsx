import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  normalizeInterest,
  validInterest,
} from '../../src/core/domain/interests.js';
import { label } from './api';
import { ErrorNotice } from './components';

export function InterestSelect({
  name,
  title,
  choices,
  initial = [],
  required = false,
}: {
  name: string;
  title: string;
  choices: readonly string[];
  initial?: string[];
  required?: boolean;
}) {
  const id = useId();
  const [selected, setSelected] = useState(() => [
    ...new Set(initial.map(normalizeInterest)),
  ]);
  const [other, setOther] = useState(false);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  function add(value: string) {
    const normalized = normalizeInterest(value);
    if (!validInterest(normalized)) {
      setError(
        'Enter 1–80 characters, using the actual name of your topic or industry.',
      );
      return;
    }
    if (selected.length >= 30 && !selected.includes(normalized)) {
      setError('You can select up to 30 interests.');
      return;
    }
    setSelected((items) => [...new Set([...items, normalized])]);
    setOther(false);
    setCustom('');
    setError('');
  }
  return (
    <fieldset className="interest-select">
      <legend>
        {title}
        {required && <span aria-hidden="true"> *</span>}
      </legend>
      <div className="selected-interests">
        {selected.map((value) => (
          <span className="interest-chip" key={value}>
            <input type="hidden" name={name} value={value} />
            {label(value)}
            <button
              type="button"
              aria-label={`Remove ${label(value)}`}
              onClick={() => setSelected(selected.filter((v) => v !== value))}
            >
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      <select
        aria-label={`Add ${title.toLowerCase()}`}
        aria-describedby={`${id}-hint`}
        required={required && selected.length === 0}
        value={other ? '__others__' : ''}
        onChange={(e) => {
          if (e.target.value === '__others__') {
            setOther(true);
            setError('');
          } else if (e.target.value) add(e.target.value);
          else {
            setOther(false);
            setCustom('');
            setError('');
          }
        }}
      >
        <option value="">
          Choose {name === 'topics' ? 'a topic' : 'an industry'}…
        </option>
        {choices
          .filter((value) => !selected.includes(value))
          .map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        <option value="__others__">Others — enter your own</option>
      </select>
      {other && (
        <div className="custom-interest">
          <label htmlFor={`${id}-custom`}>
            Your {name === 'topics' ? 'topic' : 'industry'}
          </label>
          <div>
            <input
              id={`${id}-custom`}
              name={`${name}_custom`}
              required
              maxLength={80}
              pattern=".*\S.*"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setError('');
              }}
              placeholder={
                name === 'topics'
                  ? 'For example, robotics'
                  : 'For example, renewable energy'
              }
            />
            <button
              className="button secondary small"
              type="button"
              onClick={() => add(custom)}
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>
      )}
      <small id={`${id}-hint`}>
        Select one or more. Use Others if yours isn’t listed.
      </small>
      {error && <ErrorNotice message={error} />}
    </fieldset>
  );
}
