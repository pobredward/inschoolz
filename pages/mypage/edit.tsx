import React, { useState } from "react";
import { useRecoilState } from "recoil";
import { userState } from "../../store/atoms";
import Layout from "../../components/Layout";
import styled from "@emotion/styled";
import { updateUserProfile } from "../../services/userService";
import { useRouter } from "next/router";
import { useMutation } from "react-query";
import SchoolSearchEdit from "../../components/SchoolSearchEdit";
import AddressSelector from "../../components/AddressSelector";
import { errorMessages } from "../../utils/errorMessages";

const EditMyInfo: React.FC = () => {
  const [user, setUser] = useRecoilState(userState);
  const [editedUser, setEditedUser] = useState(user);
  const router = useRouter();
  const [initialSchool, setInitialSchool] = useState<
    { id: string; KOR_NAME: string; ADDRESS: string } | undefined
  >(undefined);

  const updateProfileMutation = useMutation(
    (updatedData: Partial<typeof user>) =>
      updateUserProfile(user!.uid, updatedData),
    {
      onSuccess: async () => {
        setUser(editedUser);
        alert("프로필이 성공적으로 업데이트되었습니다.");
        router.push("/mypage");
      },
      onError: () => {
        alert(errorMessages.PROFILE_UPDATE_ERROR);
      },
    }
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(editedUser);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedUser({ ...editedUser, [name]: value });
  };

  const handleSchoolChange = (school: any) => {
    setEditedUser({
      ...editedUser,
      schoolId: school.SCHOOL_CODE,
      schoolName: school.KOR_NAME,
    });
  };

  const handleAddressChange = (
    field: "address1" | "address2",
    value: string
  ) => {
    setEditedUser((prev) => ({ ...prev, [field]: value }));
  };

  const handleBack = () => {
    router.back(); // 뒤로가기 기능
  };

  return (
    <Layout>
      <Container>
        <h1>내 정보 수정</h1>
        <Form onSubmit={handleSave}>
          <FormGroup>
            <Label htmlFor="name">이름</Label>
            <Input
              type="text"
              id="name"
              name="name"
              value={editedUser?.name || ""}
              onChange={handleInputChange}
              required
            />
          </FormGroup>
          <FormGroup>
            <Label htmlFor="userId">아이디</Label>
            <Input
              type="text"
              id="userId"
              name="userId"
              value={editedUser?.userId || ""}
              readOnly
            />
          </FormGroup>
          <FormGroup>
            <Label htmlFor="email">이메일</Label>
            <Input
              type="email"
              id="email"
              name="email"
              value={editedUser?.email || ""}
              readOnly
            />
          </FormGroup>
          <FormGroup>
            <Label>주소</Label>
            <AddressSelector
              address1={editedUser?.address1 || ""}
              address2={editedUser?.address2 || ""}
              setAddress1={(value) => handleAddressChange("address1", value)}
              setAddress2={(value) => handleAddressChange("address2", value)}
            />
          </FormGroup>
          <FormGroup>
            <Label>학교</Label>
            <SchoolSearchEdit
              initialSchool={initialSchool}
              setSchool={handleSchoolChange}
              preventFormSubmit={true}
            />
          </FormGroup>
          <GradeClassWrapper>
            <SmallFormGroup>
              <SmallWrapper>
                <SmallInput
                  type="text"
                  id="grade"
                  name="grade"
                  value={editedUser?.grade || ""}
                  onChange={handleInputChange}
                  required
                />
                <SmallLabel htmlFor="grade">학년</SmallLabel>
              </SmallWrapper>
              <SmallWrapper>
                <SmallInput
                  type="text"
                  id="classNumber"
                  name="classNumber"
                  value={editedUser?.classNumber || ""}
                  onChange={handleInputChange}
                  required
                />
                <SmallLabel htmlFor="classNumber">반</SmallLabel>
              </SmallWrapper>
            </SmallFormGroup>
          </GradeClassWrapper>
          <FormGroup>
            <Label>생년월일</Label>
            <BirthDateContainer>
              <BirthInput
                type="number"
                name="birthYear"
                value={editedUser?.birthYear || ""}
                onChange={handleInputChange}
                placeholder="년"
                required
              />
              <BirthInput
                type="number"
                name="birthMonth"
                value={editedUser?.birthMonth || ""}
                onChange={handleInputChange}
                placeholder="월"
                required
              />
              <BirthInput
                type="number"
                name="birthDay"
                value={editedUser?.birthDay || ""}
                onChange={handleInputChange}
                placeholder="일"
                required
              />
            </BirthDateContainer>
          </FormGroup>
          <ButtonContainer>
            <BackButton onClick={handleBack} type="button">
              뒤로
            </BackButton>
            <SaveButton type="submit">저장</SaveButton>
          </ButtonContainer>
        </Form>
      </Container>
    </Layout>
  );
};

const Container = styled.div`
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  margin-bottom: 0.5rem;
  font-weight: bold;
`;

const Input = styled.input`
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
`;

const SaveButton = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  background-color: var(--primary-button);
  color: white;

  &:hover {
    background-color: var(--primary-hover);
  }
`;

const BackButton = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  background-color: var(--gray-button);
  color: white;

  &:hover {
    background-color: var(--gray-hover);
  }
`;

const SmallFormGroup = styled.div`
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

const GradeClassWrapper = styled.div`
  display: flex;
  gap: 1rem;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const BirthDateContainer = styled.div`
  display: flex;
  gap: 0.5rem;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const BirthInput = styled(Input)`
  flex: 1;

  @media (max-width: 768px) {
    width: 90%;
  }
`;

export default EditMyInfo;
