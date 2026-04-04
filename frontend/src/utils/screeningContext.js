import { createContext, useContext } from 'react';

export const ScreeningContext = createContext({ mode: 'standard', setMode: () => {} });
export const useScreeningMode = () => useContext(ScreeningContext);
