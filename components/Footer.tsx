import styled from "@emotion/styled";

const FooterContainer = styled.footer`
  text-align: center;
  padding: 1rem 0;
  background-color: #f8f9fa;
`;

export default function Footer() {
  return (
    <FooterContainer>
      <p>&copy; 2025 인스쿨즈. All rights reserved.</p>
    </FooterContainer>
  );
}
