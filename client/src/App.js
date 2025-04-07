import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios'; // Make sure to install axios
import Swal from 'sweetalert2'; // Import SweetAlert2
import 'sweetalert2/dist/sweetalert2.min.css'; // Import SweetAlert2 CSS
import HtmlTemplate from './component/mailTemplate';
import ReactDOMServer from 'react-dom/server';

// const rootUrl = "http://localhost:5000";
const rootUrl = "https://kms-lm-list.vercel.app";
const config = {
  headers: {
    "Content-Type": "application/json"
  },
  withCredentials: true
};



function App() {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingRow, setEditingRow] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fileOptions, setFileOptions] = useState([])
  const [fileName, setFileName] = useState("");
  const [sortWithAddress, setSortWithAddress] = useState("");
  const [toggleFileOptions, setToggleFileOptions] = useState("hidden")

  const [rowsPerPage, setRowsPerPage] = useState(20);

  // fetch files option in upload folder
  async function fetchFiles() {
    const { data } = await axios.get(`${rootUrl}/api/files`);
    console.log("fetch files ", data)
    setFileOptions(data.files)
  }

  useEffect(() => {
    fetchFiles()
  }, []);


  

  // Handle file deletion with SweetAlert2 confirmation
  const handleDeleteFile = async (fileName) => {
    try {
      // Show custom confirmation modal with SweetAlert2
      setToggleFileOptions("hidden")
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: `Do you really want to delete the file: ${fileName}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'No, keep it',
        reverseButtons: true,
      });

      // If the user confirms, proceed with file deletion
      if (result.isConfirmed) {
        await axios.delete(`${rootUrl}/api/delete-file/${fileName}`);
        Swal.fire('Deleted!', 'The file has been deleted.', 'success'); // Success notification
        setData([])
        fetchFiles(); // Re-fetch the file list after deletion
      } else {
        Swal.fire('Cancelled', 'The file was not deleted.', 'info'); // Canceled notification
      }
    } catch (error) {
      Swal.fire('Error!', 'There was an issue deleting the file.', 'error'); // Error notification
    }
  };

  // export file
  const handleExportFile = async (fileName) => {

    try {
      setToggleFileOptions("hidden")
      // Make an API request to the server to get the file
      const response = await axios.get(`${rootUrl}/api/export-file/${fileName}`, {
        responseType: 'blob', // Important for handling binary data (files)
      });

      // Create a URL for the file and trigger the download
      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', fileName); // Set the file name for download
      document.body.appendChild(link);
      link.click(); // Trigger the download
      link.remove(); // Clean up the DOM element
    } catch (error) {
      console.error("Error exporting file:", error);
      Swal.fire('Error!', 'There was an issue exporting the file.', 'error'); // Show error if any
    }
  }


  // select and show file data in table
  async function selectFileHandler(fileName) {
    setFileName(fileName)
    setToggleFileOptions("hidden")
    const { data } = await axios.get(`${rootUrl}/api/file/data/${fileName}`);
    setData(data.members.filter((v, i)=> i !== 0))
    setHeaders(data.headers)

    console.log("file data ", data.members)
  }
  // Function to convert Excel serial number to a date in dd-mm-yyyy format
  async function convertExcelDate(serial) {
    if (isNaN(serial)) return serial; // If it's empty or already a valid date, return it as is.
    // if (serial.includes("-")) return serial; // If it's already a date in yyyy-mm-dd format, do not convert.

    // Convert Excel date to JavaScript Date
    const date = new Date((serial - 25569) * 86400 * 1000);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const year = date.getFullYear();
    return `${day}-${month}-${year}`; // Return in dd-mm-yyyy format
  };

  // Handle file upload and parse the data
  // Inside the handleFileUpload function
  async function handleFileUpload(event) {
    const uploadedFile = event.target.files[0];
    setFileName(uploadedFile.name);

    const reader = new FileReader();
    reader.onload = async function (e) {
      const data = e.target.result;
      const wb = XLSX.read(data, { type: 'binary' });

      const sheet = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      setHeaders(jsonData[0]);
      const rows = jsonData.slice(1).map((row) => {
        let obj = {};
        jsonData[0].forEach(async (header, index) => {
          let value = row[index] || '';
          // Check for DOB field and convert it if necessary
          if (header.includes('DOB')) {
            value = value ? await convertExcelDate(value) : '';
          }
          // Handle EMAIL field: if present, leave it as it is; otherwise, set empty
          if (header.includes('EMAIL')) {
            value = value || '';
          }
          obj[header] = value;
        });
        return obj;
      });
      // setData(rows);

      // Send the uploaded file to the server
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('fileName', uploadedFile.name);
      const uploadedData = await axios.post(`${rootUrl}/api/upload`, { data: jsonData, fileName: uploadedFile.name }, config);
      setData(uploadedData.data.data.filter((v, i)=> i !== 0))
      setFileOptions(uploadedData.data.fileName)
    };
    reader.readAsBinaryString(uploadedFile);
  }


  // Handle saving edited data back to server
  const handleSaveEdit = async () => {
    const updatedData = [...data];
    updatedData[editingRow] = editedData;

    try {

      const result = await Swal.fire({
        title: 'Are you sure?',
        text: `Do you really want to update member: ${editedData.NAME}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, update it!',
        cancelButtonText: 'No, keep it',
        reverseButtons: true,
      });

      if (result.isConfirmed) {
        // Send updated data to the server to save changes
        const updated = await axios.put(`${rootUrl}/api/update-file`, { data: editedData, fileName: fileName, editingRow }, config);
        console.log("updated data ", updated)

        Swal.fire('Updated !', 'The Member has been updated.', 'success'); // Success notification
        // fetchFiles(); // Re-fetch the file list after deletion
        setData(updated.data.data)
        setIsModalOpen(false);
        setEditingRow(null);
        setEditedData({});

      }
      else {
        Swal.fire('Cancelled', 'The Member was not deleted.', 'info'); // Canceled notification
      }

    } catch (error) {

    }
  };



  const handleFieldChange = (e) => {
    const { name, value } = e;

    console.log("name ", name)
    console.log("value ", value)
    setEditedData((prev) => ({ ...prev, [name]: value }));
  };

  console.log("editedData ", editedData )

  // Filter the data based on the search term
  const paginatedDataOne = useMemo(() => {
    if(data.length > 0){

    let filtered = data.filter((row) => {
      return Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    // Calculate total number of pages after filtering
    const totalPages = Math.ceil(filtered.length / rowsPerPage);

    // Ensure the current page doesn't exceed total pages
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages); // Reset to last page if out of range
    }

    // Sorting logic
    const sortKey = sortWithAddress.split("-")[0];
    const sortOrder = sortWithAddress.split("-")[1];

    filtered.sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      // Check if the values are numeric (excluding null or undefined)
      const aIsNumber = !isNaN(aValue) && aValue !== null && aValue !== '';
      const bIsNumber = !isNaN(bValue) && bValue !== null && bValue !== '';

      if (aIsNumber && bIsNumber) {
        // If both values are numbers, sort numerically
        return sortOrder === "ASC" ? aValue - bValue : bValue - aValue;
      } else {
        // If at least one value is not numeric, sort as strings
        const aStr = String(aValue);
        const bStr = String(bValue);
        return sortOrder === "ASC"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      }
    });

    // Pagination: Slice the data
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = currentPage * rowsPerPage;
    let paginatedData = filtered.slice(startIndex, endIndex);

    return paginatedData;
  }
  }, [data, searchTerm, sortWithAddress, fileOptions, fileName, currentPage, rowsPerPage]);

  // sort table 
  const sortDataFunc = (e) => {
    const { name, value } = e;
    setSortWithAddress(value)
  }

  // delete member and update table
  const deleteMemberFun = async (memberNumber, memberName) => {
    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: `Do you really want to delete member: ${memberName}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'No, keep it',
        reverseButtons: true,
      });

      if (result.isConfirmed) {
        // Step 1: Filter out the member to be deleted from the data list
        const dataAfterDelete = data.filter(v => v.MEMBER !== memberNumber);

        // Step 2: Send the updated data and file name to the server
        const updated = await axios.put(`${rootUrl}/api/delete-member`, {
          data: dataAfterDelete,
          fileName: fileName,
          memberNumber: memberNumber
        }, config);

        Swal.fire('Deleted!', 'The Member has been deleted.', 'success'); // Success notification
        fetchFiles(); // Re-fetch the file list after deletion

        setData(updated.data.data)
      }
      else {
        Swal.fire('Cancelled', 'The Member was not deleted.', 'info'); // Canceled notification
      }

    } catch (error) {
      Swal.fire('Error!', 'There was an issue deleting the Member.', 'error'); // Error notification
      console.error("Error updating file:", error);
    }
  };

  const [isMailModalOpen, setIsMailModalOpen] = useState(false);
  const [mailForm, setMailForm] = useState({
    to : "",
    from : "",
    date : "",
    message : "",
    attachment : "",
    subject : "",
    member : "",
    htmlContent : ""
  })
  const toggleMailForm = async (row) => {
    setMailForm({
    to : row.EMAIL,
    from : "",
    // message : <HtmlTemplate mailData={mailForm} senderData={row}/>,
    message : "",
    attachment : "",
    subject : "",
    member : row.MEMBER,
    htmlContent : ""
    })
    setEditingRow(row)
    setIsMailModalOpen(true);
  }

  
  const submitMail = async () => {
    const htmlContent = ReactDOMServer.renderToStaticMarkup(
      <HtmlTemplate senderData={editedData} mailData={mailForm} row={editingRow} />
    );
    try {
      if(mailForm.to && mailForm.from && mailForm.message && mailForm.subject ){
        const {data} = await axios.post(`${rootUrl}/api/send-bulk-email/${mailForm.from}`, {...mailForm, ...editingRow, htmlContent : htmlContent});
        console.log("data mail success ", data )
      }
    } catch (error) {
      
    }
  }

  const handleMailFormChange = (e) => {
    const {name, value} = e;
      setMailForm({...mailForm, [name] : value})
  }

  console.log("mail forma values ", mailForm)

  return (
    <div className="max-w-4xl mx-auto my-5 p-5 bg-white rounded-lg shadow-lg max-w-full overflow-auto">
      <div className="flex flex-wrap items-center justify-start mb-4 gap-y-2">

        {/* Button for deleting a file */}
        <div className='w-max flex flex-col justify-start items-start relative z-10'>
          <span className='w-full block cursor-pointer text-xs gap-x-3 p-3 py-3.5 border border-gray-300 rounded-lg bg-gray-50 shadow-sm w-max max-w-xs h-full ' onClick={(e) => setToggleFileOptions(v => v === "hidden" ? "flex" : "hidden")}>File Options {toggleFileOptions === "hidden" ? "🔽" : "🔼"}</span>
          <ul className={`w-max ${toggleFileOptions} flex-col gap-y-1 bg-gray-50 px-4 py-4 absolute z-20 left-0 top-[18px]`}>
            {fileOptions.length > 0 ? (
              fileOptions.map((file, i) => (
                <li className='text-xs flex felx-row items-center justify-between gap-x-2 border-t ' key={i}>
                  <span className='max-w-[160px] overflow-hidden' title={file}> {file} </span>
                  <div className='flex flex-row gap-x-1'>
                    <button className="text-[7px] text-gray-50 px-3 py-1 bg-red-500 rounded-sm" onClick={(e) => handleDeleteFile(file)}>Delete</button>
                    <button className="text-[7px] text-gray-50 px-3 py-1 bg-green-500 rounded-sm" onClick={(e) => handleExportFile(file)}>Export</button>
                    <button className="text-[7px] text-gray-50 px-3 py-1 bg-blue-500 rounded-sm" onClick={(e) => selectFileHandler(file)}>Upload</button>
                  </div>
                </li>
              ))
            ) : (
              <span className='text-[8px] '>No Files Available</span>
            )}
          </ul>
        </div>

        <fieldset className="flex items-center gap-x-3 p-3 border border-gray-300 rounded-lg bg-gray-50 shadow-sm w-max max-w-xs ml-3">
          {/* Custom File Input */}
          <label htmlFor="file-input" className="cursor-pointer text-gray-700 font-semibold text-sm">
            <span className="bg-blue-600 text-white text-[10px] px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              File
            </span>
          </label>
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"  // Hide default input, since we're styling it with label
          />

          {/* Display Selected File Name */}
          <span className="text-gray-800 font-medium text-[10px]">{fileName || "No File Selected"}</span>
        </fieldset>
        {/* reload page and set number of results per page */}
            <button className='text-[10px] text-gold-500 gap-x-3 p-3 rounded-lg bg-gray-50 shadow-sm w-max max-w-xs bg-orange-500 rounded-sm hover:bg-orannge-600 text-gray-50 ml-3' onClick={()=> window.location.reload()}>Reload Page</button>


        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search..."
          className="p-2 border border-gray-300 rounded-md w-full"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
  <table className="min-w-full w-max table-auto border-collapse mb-4">
    <thead className="bg-gray-100">
      <tr>
        {headers.map((header, index) => (
          <th key={index} className="px-4 py-2 text-xs md:text-sm border-b text-left font-semibold text-gray-700">
            {header}
            {(header === "ADDRESS" || header === "MEMBER") ? 
              <fieldset className='ml-1 flex gap-x-[4px] mt-[6px]'>
                <span className='flex flex-col'>
                  <label className='text-[8px]' htmlFor={`${header}-SORT-NONE`}>NONE</label>
                  <input defaultChecked={true} onChange={(e) => sortDataFunc(e.target)} type='radio' name={`${header}-SORT`} id={`${header}-SORT-NONE`} className='text-xs' value="" />
                </span>

                <span className='flex flex-col'>
                  <label className='text-[8px]' htmlFor={`${header}-SORT-ASC`}>ASC</label>
                  <input onChange={(e) => sortDataFunc(e.target)} type='radio' name={`${header}-SORT`} id={`${header}-SORT-ASC`} className='text-xs' value={`${header}-ASC`} />
                </span>

                <span className='flex flex-col'>
                  <label className='text-[8px]' htmlFor={`${header}-SORT-DESC`}>DESC</label>
                  <input onChange={(e) => sortDataFunc(e.target)} type='radio' name={`${header}-SORT`} id={`${header}-SORT-DESC`} className='text-xs' VALUE={`${header}-DESC`} />
                </span>
              </fieldset>
              : ""
            }
          </th>
        ))}
        <th className="px-4 py-2 border-b text-left font-semibold text-gray-700">Actions</th>
      </tr>
    </thead>
    <tbody>
      {paginatedDataOne?.map((row, rowIndex) => (
        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
          {headers.map((header, colIndex) => (
            <td key={colIndex} className="px-4 py-2 text-xs md:text-sm text-gray-600">
              {row[header] || ''}
            </td>
          ))}
          <td className="px-3 py-1.5 flex gap-x-1 gap-y-1 border-b text-xs text-gray-600">
            <button
              onClick={async () => {
                if (isNaN(row.MEMBER)) {
                  const result = await Swal.fire({
                    title: 'Member id is not correct !',
                    text: `Can not delete the member !`,
                    icon: 'warning',
                    showCancelButton: true,
                    cancelButtonText: 'Okay, Cancel !',
                    reverseButtons: true,
                  });

                  if (result.isConfirmed) {
                  }
                  else {
                    Swal.fire('Cancelled', 'deletation of member has cancelled.', "info"); // Canceled notification
                  }
                }
                else {
                  deleteMemberFun(row.MEMBER, row.NAME)
                  setEditingRow(rowIndex);
                  setEditedData(row);
                }
              }}
              className="px-3 py-1.5 bg-red-500 text-xs text-white rounded-md"
            >
              {isNaN(row.MEMBER) ? <span className='line-through'>Delete</span> : "Delete"}
            </button>
            <button
              onClick={async () => { 
                  setEditingRow(rowIndex);
                  setEditedData(row);
                  setIsModalOpen(true);
              }}
              className="px-3 py-1.5 bg-blue-500 text-xs text-white rounded-md"
            >
              {isNaN(row.MEMBER) ? <span className='line-through'>Edit</span> : "Edit"}
            </button>
            <button className="px-3 py-1.5 bg-blue-500 text-xs text-white rounded-md" onClick={()=> toggleMailForm(row)}> Mail </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>


      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => setCurrentPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 bg-gray-200 text-gray-600 rounded-md cursor-pointer"
        >
          Previous
        </button>
        <button
          onClick={() => setCurrentPage(currentPage + 1)}
          // disabled={endIndex >= filteredData.length}
          className="p-2 bg-gray-200 text-gray-600 rounded-md cursor-pointer"
        >
          Next
        </button>
      </div>

      {isMailModalOpen && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96 max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-semibold mb-3"> Send Mail </h2>
            {Object.keys(mailForm)?.map((mail, i) => {
           return mail !== "htmlContent" &&  <div key={mail} className="mb-4">
                <label htmlFor={mail} className="block text-gray-700 text-xs mb-1 text-uppercase">{mail}</label>
                {mail !== "message" ? <input
                  type={mail === "attachment" ? "file" : mail === "date" ? "date" : mail === "to"  ? "email" : "text"}
                  id={mail}
                  name={mail}
                  defaultValue={mailForm[mail]}
                  onChange={(e)=> handleMailFormChange(e.target)}
                  className="w-full p-2 border border-gray-300 rounded-sm text-xs"
                /> :
                <textarea
                  id={mail}
                  name={mail}
                  defaultValue={mailForm[mail]}
                  onChange={(e)=> handleMailFormChange(e.target)}
                  className="w-full p-2 border border-gray-300 rounded-sm text-xs"
                ></textarea>
                }
              </div>
 } )}
            <div className="flex justify-between">
              <button onClick={()=> submitMail()} className="px-4 py-2 bg-green-500 text-white rounded-sm text-xs">Send</button>
              <button
                onClick={() => {
                  setIsMailModalOpen(false);
                  // setEditedData({});
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-sm text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96 max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-semibold mb-3">Edit Row</h2>
            {Object.keys(editedData).map((header) => (
              <div key={header} className="mb-4">
                <label htmlFor={header} className="block text-gray-700 text-xs mb-1">{header}</label>
                <input
                  type="text"
                  id={header}
                  name={header}
                  defaultValue={editedData[header]}
                  onChange={(e)=>handleFieldChange(e.target)}
                  className="w-full p-2 border border-gray-300 rounded-sm text-xs"
                />
              </div>
            ))}
            <div className="flex justify-between">
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-green-500 text-white rounded-sm text-xs">Save</button>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingRow(null);
                  setEditedData({});
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-sm text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
