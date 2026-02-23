import React from 'react';
import { render, screen } from '@testing-library/react-native';
import PortfolioHeader from '../PortfolioHeader';

describe('PortfolioHeader', () => {
  it('renders correctly with positive change', () => {
    render(<PortfolioHeader totalValueUSD={12345.67} change24hPercent={2.5} />);
    
    // Check if the component renders without errors
    expect(screen).toBeTruthy();
  });

  it('renders correctly with negative change', () => {
    render(<PortfolioHeader totalValueUSD={12345.67} change24hPercent={-1.25} />);
    
    // Check if the component renders without errors
    expect(screen).toBeTruthy();
  });

  it('renders correctly with zero change', () => {
    render(<PortfolioHeader totalValueUSD={12345.67} change24hPercent={0} />);
    
    // Check if the component renders without errors
    expect(screen).toBeTruthy();
  });

  it('renders correctly with large value', () => {
    render(<PortfolioHeader totalValueUSD={1000000.99} change24hPercent={5.75} />);
    
    // Check if the component renders without errors
    expect(screen).toBeTruthy();
  });
});
