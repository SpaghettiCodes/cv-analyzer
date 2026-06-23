import React from "react";

const TagDivs = ({ tagData, clicked, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 text-sm rounded-full border transition font-medium
      ${clicked
        ? 'bg-violet-700 border-violet-700 text-white'
        : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-700'}`}
  >
    {tagData.tag_name}
  </button>
);

export default TagDivs;
