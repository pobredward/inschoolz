import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "../components/Layout";
import styled from "@emotion/styled";
import { useSetRecoilState } from "recoil";
import { userState } from "../store/atoms";
import { useMutation } from "react-query";
import { useAuthStateManager } from "../hooks/useAuthStateManager";
import { errorMessages } from "../utils/errorMessages";
import { auth } from "../lib/firebase";
import Head from "next/head";

const LoginPage: React.FC = () => {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const setUser = useSetRecoilState(userState);
  const { login, updateUserState } = useAuthStateManager();

  const loginMutation = useMutation(
    async ({ userId, password }: { userId: string; password: string }) => {
      if (!userId.trim() || !password.trim()) {
        throw new Error(errorMessages.EMPTY_FIELDS);
      }

      // 여기서 userId를 이메일로 변환하는 로직이 필요할 수 있습니다.
      // 예: const email = await getUserEmailByUserId(userId);
      const email = userId; // 임시로 userId를 email로 사용

      await login(email, password);
      const updatedUser = await updateUserState(auth.currentUser);
      return updatedUser;
    },
    {
      onSuccess: (userData) => {
        setUser(userData);
        router.push("/");
      },
      onError: (error: Error) => {
        setError(error.message || errorMessages.UNKNOWN_ERROR);
      },
    }
  );

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ userId, password });
  };

  return (
    <Layout>
      <Head>
        <title>로그인</title>
        <meta property="og:title" content="로그인" />
        <meta
          property="og:description"
          content="로그인 후 다양한 서비스를 이용하세요."
        />
        <meta property="og:url" content="https://www.inschoolz.com/login" />
      </Head>
      <LoginContainer>
        <h1>로그인</h1>
        <Form onSubmit={handleLogin}>
          <Input
            type="text"
            placeholder="이메일"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={loginMutation.isLoading}>
            {loginMutation.isLoading ? "로그인 중..." : "로그인"}
          </Button>
        </Form>
        {loginMutation.isError && <ErrorMessage>{error}</ErrorMessage>}
        <SignupLink>
          계정이 없으신가요? <Link href="/signup">회원가입</Link>
        </SignupLink>
      </LoginContainer>
    </Layout>
  );
};

const LoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem 1rem;

  h1 {
    margin-bottom: 2rem;
    color: #333;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 1rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
`;

const Button = styled.button`
  width: 100%;
  padding: 0.75rem;
  background-color: var(--primary-button);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: var(--primary-hover);
  }

  &:disabled {
    background-color: var(--gray-button);
    cursor: not-allowed;
  }
`;

const GoogleButton = styled(Button)`
  background-color: #4285f4;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background-color: #3367d6;
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  text-align: center;
  width: 100%;
  margin: 1rem 0;

  &::before,
  &::after {
    content: "";
    flex: 1;
    border-bottom: 1px solid #ccc;
  }

  &::before {
    margin-right: 0.5em;
  }

  &::after {
    margin-left: 0.5em;
  }
`;

const ErrorMessage = styled.p`
  color: red;
  text-align: center;
  margin-top: 1rem;
`;

const SignupLink = styled.p`
  text-align: center;
  margin-top: 1rem;

  a {
    color: var(--primary-text);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

export default LoginPage;
