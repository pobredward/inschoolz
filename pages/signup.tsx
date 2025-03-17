import React, { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "../components/Layout";
import styled from "@emotion/styled";
import { useAuthStateManager } from "../hooks/useAuthStateManager";
import AddressSelector from "../components/AddressSelector";
import SchoolSearchSignup from "../components/SchoolSearchSignup";
import { sendEmailVerification } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { errorMessages } from "../utils/errorMessages";
import { useMutation } from "react-query";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  updateUserExperience,
  getExperienceSettings,
} from "../utils/experience";
import ExperienceModal from "../components/modal/ExperienceModal";
import { School } from "../types";

const SignupPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [school, setSchool] = useState<School | null>(null);
  const [grade, setGrade] = useState("");
  const [classNumber, setClassNumber] = useState("");
  const [birthYear, setBirthYear] = useState<number>(0);
  const [birthMonth, setBirthMonth] = useState<number>(0);
  const [birthDay, setBirthDay] = useState<number>(0);
  const [error, setError] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [inviterUserId, setInviterUserId] = useState("");
  const [userIdMessage, setUserIdMessage] = useState("");

  const [showExpModal, setShowExpModal] = useState(false);
  const [expGained, setExpGained] = useState(0);
  const [newLevel, setNewLevel] = useState(1);

  const router = useRouter();
  const { updateUserState } = useAuthStateManager();

  const signupMutation = useMutation(
    async (userData: any) => {
      const {
        email,
        password,
        userId,
        name,
        phoneNumber,
        address1,
        address2,
        schoolId,
        schoolName,
        grade,
        classNumber,
        schoolAddress,
        birthYear,
        birthMonth,
        birthDay,
      } = userData;

      // Firebase Auth로 사용자 생성
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Firestore에 사용자 정보 저장
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email,
        userId,
        name,
        // phoneNumber,
        address1,
        address2,
        schoolId,
        schoolName,
        schoolAddress,
        grade,
        classNumber,
        birthYear,
        birthMonth,
        birthDay,
        experience: 0,
        totalExperience: 0,
        level: 1,
        invitedBy: inviterUserId || null,
      });

      // 이메일 인증 메일 발송
      await sendEmailVerification(user);

      // 초대 코드가 입력된 경우, 초대한 유저와 초대받은 유저 모두 경험치를 얻음
      if (inviterUserId) {
        const inviterUserQuery = query(
          collection(db, "users"),
          where("userId", "==", inviterUserId)
        );
        const inviterSnapshot = await getDocs(inviterUserQuery);

        if (!inviterSnapshot.empty) {
          const inviterDoc = inviterSnapshot.docs[0];
          const inviterId = inviterDoc.id;

          const settings = await getExperienceSettings();
          const invitationExp = settings.friendInvitation;

          // 초대한 사용자의 경험치 업데이트
          await updateUserExperience(
            inviterId,
            invitationExp,
            "친구 초대 완료"
          );

          // 초대받은 사용자(새 사용자)의 경험치 업데이트
          const newUserResult = await updateUserExperience(
            user.uid,
            invitationExp,
            "친구 초대로 가입"
          );

          setExpGained(newUserResult.expGained);
          if (newUserResult.levelUp) {
            setNewLevel(newUserResult.newLevel);
          }
          setShowExpModal(true);
        }
      }

      return user;
    },
    {
      onSuccess: async (user) => {
        setVerificationSent(true);

        const updatedUser = await updateUserState(user);
        // Recoil 상태 업데이트 (필요한 경우)
      },
      onError: (error: Error) => {
        setError(error.message || errorMessages.UNKNOWN_ERROR);
      },
    }
  );

  const validateUserId = (userId: string): boolean => {
    return userId.length >= 6 && userId.length <= 20;
  };

  const validateName = (name: string): boolean => {
    const koreanNameRegex = /^[가-힣]{2,5}$/;
    return koreanNameRegex.test(name);
  };

  const validatePassword = (password: string): boolean => {
    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(password);
  };

  const checkDuplicateEmail = async (email: string) => {
    const q = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  const checkDuplicateUserId = async (userId: string) => {
    if (!validateUserId(userId)) {
      setUserIdMessage("ID는 6자 이상 20자 이하이어야 합니다.");
      return true;
    }

    const q = query(collection(db, "users"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      setUserIdMessage(errorMessages.DUPLICATE_USER_ID);
      return true;
    } else {
      setUserIdMessage("사용 가능한 ID입니다.");
      return false;
    }
  };

  const checkDuplicatePhoneNumber = async (phoneNumber: string) => {
    const q = query(
      collection(db, "users"),
      where("phoneNumber", "==", phoneNumber)
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !name ||
      !userId ||
      !email ||
      !password ||
      !confirmPassword ||
      // !phoneNumber ||
      !address1 ||
      !address2 ||
      !school ||
      !grade ||
      !classNumber ||
      !birthYear ||
      !birthMonth ||
      !birthDay
    ) {
      setError("모든 필드를 입력해주세요.");
      return;
    }

    if (!validateUserId(userId)) {
      setError("ID는 6자 이상 20자 이하이어야 합니다.");
      return;
    }

    if (!validateName(name)) {
      setError("실명은 한글 2~5자여야 합니다.");
      return;
    }

    if (!validatePassword(password)) {
      setError(
        "비밀번호는 8자리 이상이며, 숫자, 영문, 특수문자(@$!%*#?&)를 각각 하나 이상 포함해야 합니다."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    const isDuplicateEmail = await checkDuplicateEmail(email);
    if (isDuplicateEmail) {
      setError("이미 사용 중인 이메일 주소입니다.");
      return;
    }

    const isDuplicateUserId = await checkDuplicateUserId(userId);
    if (isDuplicateUserId) {
      setError("이미 사용 중인 ID입니다.");
      return;
    }

    // const isDuplicatePhoneNumber = await checkDuplicatePhoneNumber(phoneNumber);
    // if (isDuplicatePhoneNumber) {
    //   setError("이미 등록된 휴대폰 번호입니다.");
    //   return;
    // }

    // const phoneRegex = /^01[016789]-?\d{3,4}-?\d{4}$/;
    // if (!phoneRegex.test(phoneNumber)) {
    //   setError("올바른 휴대폰 번호 형식이 아닙니다.");
    //   return;
    // }

    const currentYear = new Date().getFullYear();
    if (birthYear < 1900 || birthYear > currentYear) {
      setError("올바른 출생 연도를 입력해주세요.");
      return;
    }
    if (birthMonth < 1 || birthMonth > 12) {
      setError("올바른 출생 월을 선택해주세요.");
      return;
    }
    if (birthDay < 1 || birthDay > 31) {
      setError("올바른 출생일을 선택해주세요.");
      return;
    }

    if (!school || !school.SCHOOL_CODE) {
      setError("학교를 선택해주세요.");
      return;
    }

    try {
      await signupMutation.mutateAsync({
        email,
        password,
        userId,
        name,
        // phoneNumber,
        address1,
        address2,
        schoolId: school?.SCHOOL_CODE || "",
        schoolName: school?.KOR_NAME || "",
        schoolAddress: school?.ADDRESS || "",
        grade,
        classNumber,
        birthYear,
        birthMonth,
        birthDay,
      });
    } catch (error) {
      setError((error as Error).message || errorMessages.UNKNOWN_ERROR);
    }
  };

  if (verificationSent) {
    return (
      <Container>
        <VerificationMessage>
          <h2>이메일 인증을 완료해주세요</h2>
          <p>
            {email}로 인증 메일을 보냈습니다. 메일함을 확인하고 인증 링크를
            클릭해주세요.
          </p>
          <p>
            인증이 완료되면 <Link href="/">메인 페이지</Link>로 이동하여
            인스쿨즈를 시작해보세요!
          </p>
        </VerificationMessage>
      </Container>
    );
  }

  return (
    <Layout>
      <Container>
        <h1>회원가입</h1>
        <Form onSubmit={handleSignup}>
          <Label>이름</Label>
          <Input
            type="text"
            placeholder="이름 입력 (실명)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Label>아이디</Label>
          <InputContainer>
            <IdInput
              type="text"
              placeholder="아이디 입력 (6자~20자)"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            />
            <IdButton
              type="button"
              onClick={async () => {
                await checkDuplicateUserId(userId);
              }}
            >
              중복 확인
            </IdButton>
          </InputContainer>
          {userIdMessage && (
            <Message isSuccess={userIdMessage === "사용 가능한 ID입니다."}>
              {userIdMessage}
            </Message>
          )}
          <Label>
            이메일
            {/* <SmallText>이후 변경이 불가합니다</SmallText> */}
          </Label>

          <Input
            type="email"
            placeholder="이메일 입력"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Label>비밀번호</Label>
          <Input
            type="password"
            placeholder="비밀번호 입력 (특수문자 포함 8자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Label>비밀번호 확인</Label>
          <Input
            type="password"
            placeholder="비밀번호 재입력"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {/* <Label>휴대폰 번호</Label>
          <Input
            type="tel"
            placeholder="휴대폰 번호 ( '-' 제외 11자)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
          /> */}
          <Label>주소</Label>
          <AddressSelector
            address1={address1}
            address2={address2}
            setAddress1={setAddress1}
            setAddress2={setAddress2}
          />
          <Label>학교</Label>
          <SchoolSearchSignup setSchool={setSchool} />
          <GradeClassWrapper>
            <FormGroup>
              <SmallWrapper>
                <SmallInput
                  type="text"
                  id="grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="학년"
                  required
                />
                <SmallLabel htmlFor="grade">학년</SmallLabel>
              </SmallWrapper>
              <SmallWrapper>
                <SmallInput
                  type="text"
                  id="class"
                  value={classNumber}
                  onChange={(e) => setClassNumber(e.target.value)}
                  placeholder="반"
                  required
                />
                <SmallLabel htmlFor="class">반</SmallLabel>
              </SmallWrapper>
            </FormGroup>
          </GradeClassWrapper>
          <Label>생년월일</Label>
          <DateOfBirthContainer>
            <Select
              value={birthYear}
              onChange={(e) => setBirthYear(parseInt(e.target.value))}
              required
            >
              <option value="">년도</option>
              {Array.from({ length: 100 }, (_, i) => (
                <option key={i} value={2023 - i}>
                  {2023 - i}
                </option>
              ))}
            </Select>
            <Select
              value={birthMonth}
              onChange={(e) => setBirthMonth(parseInt(e.target.value))}
              required
            >
              <option value="">월</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </Select>
            <Select
              value={birthDay}
              onChange={(e) => setBirthDay(parseInt(e.target.value))}
              required
            >
              <option value="">일</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </Select>
          </DateOfBirthContainer>
          <Label>초대 코드 (선택사항)</Label>
          <Input
            type="text"
            placeholder="추천 친구의 인스쿨즈 아이디 입력"
            value={inviterUserId}
            onChange={(e) => setInviterUserId(e.target.value)}
          />
          <Button type="submit" disabled={signupMutation.isLoading}>
            {signupMutation.isLoading ? "처리 중..." : "회원가입"}
          </Button>
        </Form>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <LoginLink>
          이미 계정이 있으신가요? <Link href="/login">로그인</Link>
        </LoginLink>
        {showExpModal && (
          <ExperienceModal
            isOpen={showExpModal}
            onClose={() => {
              setShowExpModal(false);
              router.push("/");
            }}
            expGained={expGained}
            newLevel={newLevel}
          />
        )}
      </Container>
    </Layout>
  );
};

const Container = styled.div`
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

  @media (max-width: 768px) {
    max-width: 90%;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 0.1rem;
`;

const Button = styled.button`
  padding: 0.75rem;
  height: 100%;
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

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--gray-button);
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
  margin: 0 0 0.5rem 0;
`;

const FormGroup = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
`;

const SmallWrapper = styled.div`
  display: flex;
  gap: 10px;
`;

const SmallInput = styled.input`
  width: 40%;
  padding: 0.75rem;
  border: 1px solid var(--gray-button);
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
  margin: 0 0 0.5rem 0;
`;

const SmallLabel = styled.label`
  font-weight: bold;
  margin-bottom: 0.25rem;
  margin: auto 0;
`;

const IdInput = styled(Input)`
  flex: 2 2 0;
  margin: 0;
`;

const IdButton = styled(Button)`
  flex: 1 1 0;
  margin: 0;
`;

const InputContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const Select = styled.select`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--gray-button);
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
`;

const GradeClassWrapper = styled.div`
  display: flex;
  gap: 1rem;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const DateOfBirthContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  margin: 0 0 0.5rem 0;
`;

const Label = styled.label`
  font-weight: bold;
  margin-bottom: 0.25rem;
`;

const SmallText = styled.span`
  font-weight: normal;
  color: red;
  font-size: 0.8rem;
  margin-left: 0.5rem;
`;

const Message = styled.p<{ isSuccess: boolean }>`
  color: ${(props) => (props.isSuccess ? "green" : "red")};
  margin: 0 0 0.5rem 0;
`;

const ErrorMessage = styled.p`
  color: red;
  text-align: center;
`;

const LoginLink = styled.p`
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

const VerificationMessage = styled.div`
  text-align: center;

  h2 {
    margin-bottom: 1rem;
    color: #333;
  }

  p {
    margin-bottom: 0.5rem;
  }

  a {
    color: var(--primary-text);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

export default SignupPage;
