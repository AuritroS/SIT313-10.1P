import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Container,
  Header,
  Form,
  Button,
  Segment,
  Message,
  Divider,
  Icon,
} from 'semantic-ui-react';
import {
  signInWithGooglePopup,
  createUserDocFromAuth,
  signInAuthUserWithEmailAndPassword,
} from '../../api/firebase';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e, { name, value }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async () => {
    try {
      setSubmitting(true);
      await signInAuthUserWithEmailAndPassword(form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      console.log(err);
      alert('Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setSubmitting(true);
      const { user } = await signInWithGooglePopup();
      await createUserDocFromAuth(user);
      navigate('/', { replace: true });
    } catch (err) {
      console.log(err);
      alert('Google sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container text style={{ marginTop: 48 }}>
      <Header as="h2" content="Login" />

      <Segment>
        <Form onSubmit={handleLogin} loading={submitting}>
          <Form.Input
            label="Email"
            placeholder="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
          />
          <Form.Input
            label="Password"
            placeholder="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
          />

          <Button primary fluid content="Login" className='btn-primary' />

          <Divider horizontal>or</Divider>

          <Button type="button" fluid onClick={handleGoogle}>
            <Icon name="google" />
            Login with Google
          </Button>
        </Form>
      </Segment>

      <Message>
        Don’t have an account? <Link to="/signup">Sign up</Link>
      </Message>
    </Container>
  );
};

export default Login;
