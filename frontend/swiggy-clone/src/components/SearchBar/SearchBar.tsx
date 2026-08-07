import type  { ChangeEvent } from 'react';
import './SearchBar.css';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        onChange(event.target.value);
    }

    /*
        This input is a plain controlled input — it updates on every keystroke, no debounce inside it. 
        The debounce lives one level up, on the value that triggers the fetch. That split matters:
         the person typing sees instant feedback in the box (no input lag), while the expensive side effect waits for a pause. 
         Debouncing the input's own display value would make typing itself feel laggy — a real, common mistake.
    */
    return(
        <div className='search-bar'>
            <label htmlFor='restaurant-search' className='search-bar__label'>
                search restaurants
            </label>
            <input
                id='restaurant-search'
                type='text'
                className='search-bar__input'
                placeholder='Search for restaurants'
                value={value}
                onChange={handleChange}
                autoComplete='off'
            />
        </div>
    );
}