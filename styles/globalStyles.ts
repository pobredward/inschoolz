import { css } from "@emotion/react";

export const globalStyles = css`
  :root {
    /* Primary Colors */
    --primary-button: #50ad3d;
    --primary-text: #2f7b20;
    --primary-hover: #469e35;

    /* Gray Colors */
    --gray-button: #cccccc;
    --gray-text: #666666;
    --gray-hover: #b3b3b3;

    /* Edit (Blue) Colors */
    --edit-button: #3544a0;
    --edit-text: #3132ca;
    --edit-hover: #2c3a94;

    /* Delete (Red) Colors */
    --delete-button: #b42e2f;
    --delete-text: #f24e48;
    --delete-hover: #a32629;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto",
      "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans",
      "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
`;

export const theme = {
  colors: {
    // Primary
    primaryBtn: "var(--primary-button)",
    primaryTxt: "var(--primary-text)",
    primaryHvr: "var(--primary-hover)",

    // Gray
    grayBtn: "var(--gray-button)",
    grayTxt: "var(--gray-text)",
    grayHvr: "var(--gray-hover)",

    // Edit (Blue)
    editBtn: "var(--edit-button)",
    editTxt: "var(--edit-text)",
    editHvr: "var(--edit-hover)",

    // Delete (Red)
    delBtn: "var(--del-button)",
    delTxt: "var(--del-text)",
    delHvr: "var(--del-hover)",
  },
};
