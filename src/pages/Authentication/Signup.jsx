import React, { useState, startTransition } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Container,
  Header,
  Form,
  Button,
  Segment,
  Message,
} from "semantic-ui-react";
import {
  createAuthUserWithEmailAndPassword,
  createUserDocFromAuth,
} from "../../api/firebase";
import bcrypt from "bcryptjs";

const Signup = () => {
  const [contact, setContact] = useState({
    displayName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const { displayName, lastName, email, password, confirmPassword } = contact;

  const handleChange = (e, { name, value }) => {
    setContact((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (password !== confirmPassword) {
      return alert("Passwords do not match!");
    }
    try {
      setSubmitting(true);

      const { user } = await createAuthUserWithEmailAndPassword(
        email,
        password
      );

      // Hash password with bcrypt
      const passwordHash = await bcrypt.hash(password, 10);

      // Store profile in Firestore with hash
      await createUserDocFromAuth(user, {
        displayName,
        lastName,
        passwordHash,
      });

      startTransition(() => {
        navigate("/login", { replace: true });
      });
    } catch (err) {
      console.log("error creating user", err.message);
      alert("Sign up failed. " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container text style={{ marginTop: 48 }}>
      <Header as="h2" content="Create account" />
      <Segment>
        <Form onSubmit={handleSubmit} loading={submitting}>
          <Form.Input
            label="First name"
            placeholder="first name"
            name="displayName"
            value={displayName}
            onChange={handleChange}
            required
          />
          <Form.Input
            label="Last name"
            placeholder="last name"
            name="lastName"
            value={lastName}
            onChange={handleChange}
            required
          />
          <Form.Input
            label="Email"
            placeholder="email"
            name="email"
            type="email"
            value={email}
            onChange={handleChange}
            required
          />
          <Form.Input
            label="Password"
            placeholder="password"
            name="password"
            type="password"
            value={password}
            onChange={handleChange}
            required
          />
          <Form.Input
            label="Confirm password"
            placeholder="confirm password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={handleChange}
            required
          />
          <Button primary fluid content="Sign up" className="btn-primary" />
        </Form>
      </Segment>

      <Message>
        Already have an account? <Link to="/login">Login</Link>
      </Message>
    </Container>
  );
};

export default Signup;
