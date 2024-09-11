import { AnyAction, Store } from '@reduxjs/toolkit';

import { Provider } from 'react-redux';
import React from 'react';
import { render } from '@testing-library/react';

/* eslint-disable @typescript-eslint/no-explicit-any */
 
const renderWithRedux = (component: React.ReactElement, store:Store<any, AnyAction>) => render(<Provider store={store}>{component}</Provider>);
export default renderWithRedux;
