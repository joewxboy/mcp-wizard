import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';

describe('Button Component', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('btn');
    expect(button).toHaveClass('bg-blue-600');
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-gray-200');

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-red-600');

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('border-gray-300');
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-3');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-6');
  });

  it('shows loading state', () => {
    render(<Button loading>Loading</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Button</Button>);

    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });
});

describe('Input Component', () => {
  it('renders with label', () => {
    render(<Input label="Email" />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders without label', () => {
    render(<Input placeholder="Enter text" />);

    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });

  it('shows error message', () => {
    render(<Input label="Name" error="Name is required" />);

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveClass('border-red-500');
  });

  it('shows helper text', () => {
    render(<Input label="Name" helperText="Enter your full name" />);

    expect(screen.getByText('Enter your full name')).toBeInTheDocument();
  });

  it('handles different input types', () => {
    render(<Input type="email" />);

    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
  });

  it('supports start and end adornments', () => {
    render(
      <Input
        label="Search"
        startAdornment={<span>🔍</span>}
        endAdornment={<button>Clear</button>}
      />,
    );

    expect(screen.getByText('🔍')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('handles value changes', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('forwards ref correctly', () => {
    const ref = jest.fn();
    render(<Input ref={ref} />);

    expect(ref).toHaveBeenCalled();
  });
});

describe('Card Component', () => {
  it('renders children', () => {
    render(
      <Card>
        <h1>Test Content</h1>
      </Card>,
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies default styling', () => {
    render(<Card>Test</Card>);

    const card = screen.getByText('Test').parentElement;
    expect(card).toHaveClass('card');
    expect(card).toHaveClass('p-6');
  });

  it('supports different padding sizes', () => {
    const { rerender } = render(<Card padding="sm">Test</Card>);
    expect(screen.getByText('Test').parentElement).toHaveClass('p-4');

    rerender(<Card padding="lg">Test</Card>);
    expect(screen.getByText('Test').parentElement).toHaveClass('p-8');
  });

  it('supports hover effects', () => {
    render(<Card hover>Test</Card>);

    const card = screen.getByText('Test').parentElement;
    expect(card).toHaveClass('hover:shadow-md');
  });

  it('supports click handlers', () => {
    const handleClick = jest.fn();
    render(<Card onClick={handleClick}>Test</Card>);

    fireEvent.click(screen.getByText('Test'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    render(<Card className="custom-card">Test</Card>);

    expect(screen.getByText('Test').parentElement).toHaveClass('custom-card');
  });
});
