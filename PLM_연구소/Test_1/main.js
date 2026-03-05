// 연도별 프로젝트 데이터
const projectData = {
    '2022': {
        projects: [
            {
                name: 'ACTIVIA',
                subProjects: []
            }
        ]
    },
    '2023': {
        projects: [
            {
                name: '풀무원 요거트',
                subProjects: ['하루', '솔루션', '요거톡']
            }
        ]
    },
    '2024': {
        projects: [
            {
                name: '풀무원 요거트',
                subProjects: ['하루', '솔루션', '요거톡']
            }
        ]
    },
    '2025': {
        projects: [
            {
                name: '풀무원 요거트',
                subProjects: ['하루', '솔루션', '요거톡']
            }
        ]
    }
};

// 제품별 상세 데이터 (단계별 문서)
const productDetails = {
    'ACTIVIA': [
        { stage: 'Go Define', docs: ['Go Define.pdf', 'Go Define - GM confirmed.pdf'] },
        { stage: 'Go Develop', docs: ['Go Develop.pdf', 'Go Develop - GM confirmed.pdf'] },
        { stage: 'Go Implement', docs: ['Go Implement.pdf', 'Go Implement - GM confirmed.pdf'] },
        { stage: 'Go Launch', docs: ['Go Launch.pdf', 'Go Launch - GM confirmed.pdf'] },
        { stage: 'Closure', docs: ['Closure.pdf', 'Closure - GM confirmed.pdf'] }
    ],
    '하루': [
        { stage: 'Go Define', docs: ['Go Define.pdf', 'Go Define - GM confirmed.pdf'] },
        { stage: 'Go Develop', docs: ['Go Develop.pdf', 'Go Develop - GM confirmed.pdf'] },
        { stage: 'Go Implement', docs: ['Go Implement.pdf', 'Go Implement - GM confirmed.pdf'] },
        { stage: 'Go Launch', docs: ['Go Launch.pdf', 'Go Launch - GM confirmed.pdf'] },
        { stage: 'Closure', docs: ['Closure.pdf', 'Closure - GM confirmed.pdf'] }
    ],
    '솔루션': [
        { stage: 'Go Define', docs: ['Go Define.pdf', 'Go Define - GM confirmed.pdf'] },
        { stage: 'Go Develop', docs: ['Go Develop.pdf', 'Go Develop - GM confirmed.pdf'] },
        { stage: 'Go Implement', docs: ['Go Implement.pdf', 'Go Implement - GM confirmed.pdf'] },
        { stage: 'Go Launch', docs: ['Go Launch.pdf', 'Go Launch - GM confirmed.pdf'] },
        { stage: 'Closure', docs: ['Closure.pdf', 'Closure - GM confirmed.pdf'] }
    ],
    '요거톡': [
        { stage: 'Go Define', docs: ['Go Define.pdf', 'Go Define - GM confirmed.pdf'] },
        { stage: 'Go Develop', docs: ['Go Develop.pdf', 'Go Develop - GM confirmed.pdf'] },
        { stage: 'Go Implement', docs: ['Go Implement.pdf', 'Go Implement - GM confirmed.pdf'] },
        { stage: 'Go Launch', docs: ['Go Launch.pdf', 'Go Launch - GM confirmed.pdf'] },
        { stage: 'Closure', docs: ['Closure.pdf', 'Closure - GM confirmed.pdf'] }
    ]
};

// Currently selected brand and sub-project
let currentSelectedBrand = null;
let currentSelectedYear = null;

// Tab switching functionality
document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    initYearList();
    initAddBrandButton();
    initAddYearButton();
});

// Tab Navigation
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('page-title');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            
            this.classList.add('active');
            
            const tabName = this.getAttribute('data-tab');
            const contentId = tabName + '-content';
            const content = document.getElementById(contentId);
            
            if (content) {
                content.classList.add('active');
            }
            
            if (tabName === 'archive') {
                pageTitle.textContent = 'I. CODEV ARCHIVE';
            } else if (tabName === 'ongoing') {
                pageTitle.textContent = 'II. Ongoing Projects';
            } else if (tabName === 'history') {
                pageTitle.textContent = 'III. History';
            }
        });
    });
}

// Year List Click Handler
function initYearList() {
    const yearItems = document.querySelectorAll('.year-item');
    
    yearItems.forEach(item => {
        item.addEventListener('click', function() {
            yearItems.forEach(y => y.classList.remove('active'));
            this.classList.add('active');
            
            const year = this.getAttribute('data-year');
            loadProjectsForYear(year);
        });
    });
    
    const defaultYear = document.querySelector('.year-item.active');
    if (defaultYear) {
        loadProjectsForYear(defaultYear.getAttribute('data-year'));
    }
}

// Add Year Button Handler
function initAddYearButton() {
    const btnAddYear = document.getElementById('btn-add-year');
    if (btnAddYear) {
        btnAddYear.addEventListener('click', function() {
            const yearInput = prompt('새 연도를 입력하세요 (예: 2026):');
            
            if (yearInput && yearInput.trim() !== '') {
                const year = yearInput.trim();
                
                if (!/^\d{4}$/.test(year)) {
                    alert('올바른 연도 형식을 입력해주세요 (예: 2026)');
                    return;
                }
                
                if (projectData[year]) {
                    alert('이미 존재하는 연도입니다.');
                    return;
                }
                
                projectData[year] = { projects: [] };
                
                const yearList = document.querySelector('.year-list');
                const yearItem = document.createElement('div');
                yearItem.className = 'year-item';
                yearItem.setAttribute('data-year', year);
                yearItem.innerHTML = `
                    <span class="year-number">${year}</span>
                    <span class="year-info"></span>
                `;
                
                yearItem.addEventListener('click', function() {
                    document.querySelectorAll('.year-item').forEach(y => y.classList.remove('active'));
                    this.classList.add('active');
                    const selectedYear = this.getAttribute('data-year');
                    loadProjectsForYear(selectedYear);
                });
                
                yearList.appendChild(yearItem);
                alert(`연도 "${year}"가 추가되었습니다.`);
            } else if (yearInput !== null) {
                alert('연도를 입력해주세요.');
            }
        });
    }
}

// Add Brand Button Handler
function initAddBrandButton() {
    const btnAddBrand = document.getElementById('btn-add-brand');
    if (btnAddBrand) {
        btnAddBrand.addEventListener('click', function() {
            const brandName = prompt('새 브랜드 이름을 입력하세요:');
            
            if (brandName && brandName.trim() !== '') {
                const activeYear = document.querySelector('.year-item.active');
                if (!activeYear) {
                    alert('먼저 연도를 선택해주세요.');
                    return;
                }
                
                const year = activeYear.getAttribute('data-year');
                
                if (!projectData[year]) {
                    projectData[year] = { projects: [] };
                }
                
                projectData[year].projects.push({
                    name: brandName.trim(),
                    subProjects: [],
                    products: {}
                });
                
                loadProjectsForYear(year);
                alert(`브랜드 "${brandName.trim()}"가 ${year}년에 추가되었습니다.`);
            } else if (brandName !== null) {
                alert('브랜드 이름을 입력해주세요.');
            }
        });
    }
}

// Load projects based on selected year
function loadProjectsForYear(year) {
    const projectTree = document.getElementById('project-tree');
    if (!projectTree) return;
    
    projectTree.innerHTML = '';
    
    const yearData = projectData[year];
    if (!yearData) return;
    
    yearData.projects.forEach(project => {
        const projectItem = createProjectItem(project);
        projectTree.appendChild(projectItem);
    });
}

// Create project item HTML
function createProjectItem(project) {
    const div = document.createElement('div');
    div.className = 'project-item-main';
    
    const header = document.createElement('div');
    header.className = 'project-main-header';
    
    if (project.subProjects && project.subProjects.length > 0) {
        header.innerHTML = `
            <span class="toggle-icon">▶</span>
            <span class="project-main-name">${project.name}</span>
            <button class="btn-edit-brand" title="브랜드 이름 수정">✏️</button>
            <button class="btn-add-subfolder" title="하위 폴더 추가">+</button>
        `;
    } else {
        header.innerHTML = `
            <span class="project-main-name">${project.name}</span>
            <button class="btn-edit-brand" title="브랜드 이름 수정">✏️</button>
            <button class="btn-add-subfolder" title="하위 폴더 추가">+</button>
        `;
    }
    
    const content = document.createElement('div');
    content.className = 'project-main-content';
    
    if (project.subProjects && project.subProjects.length > 0) {
        project.subProjects.forEach(subProject => {
            const subItem = document.createElement('div');
            subItem.className = 'sub-project-item';
            
            const subNameSpan = document.createElement('span');
            subNameSpan.className = 'sub-project-name';
            subNameSpan.textContent = subProject;
            
            const subEditBtn = document.createElement('button');
            subEditBtn.className = 'btn-edit-subfolder';
            subEditBtn.title = '하위 폴더 이름 수정';
            subEditBtn.textContent = '✏️';
            
            const subAddBtn = document.createElement('button');
            subAddBtn.className = 'btn-add-product-sub';
            subAddBtn.title = '제품명 추가';
            subAddBtn.textContent = '+';
            
            subItem.appendChild(subNameSpan);
            subItem.appendChild(subEditBtn);
            subItem.appendChild(subAddBtn);
            
            subNameSpan.addEventListener('click', function(e) {
                e.stopPropagation();
                selectSubProject(subProject, subItem, project.name);
            });
            
            subEditBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                editSubfolderName(project, subProject);
            });
            
            subAddBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                addProductToSubProject(project.name, subProject);
            });
            
            content.appendChild(subItem);
        });
        
        const toggleIcon = header.querySelector('.toggle-icon');
        if (toggleIcon) {
            header.addEventListener('click', function(e) {
                if (e.target.closest('.btn-add-subfolder') || e.target.closest('.btn-edit-brand')) {
                    return;
                }
                
                const isExpanded = content.classList.contains('expanded');
                
                if (isExpanded) {
                    content.classList.remove('expanded');
                    toggleIcon.textContent = '▶';
                    header.classList.remove('active');
                } else {
                    content.classList.add('expanded');
                    toggleIcon.textContent = '▼';
                    header.classList.add('active');
                }
            });
        }
    } else {
        header.addEventListener('click', function(e) {
            if (e.target.closest('.btn-add-subfolder') || e.target.closest('.btn-edit-brand')) {
                return;
            }
            selectMainProject(project.name, header);
        });
    }
    
    // Edit brand button event
    const btnEditBrand = header.querySelector('.btn-edit-brand');
    if (btnEditBrand) {
        btnEditBrand.addEventListener('click', function(e) {
            e.stopPropagation();
            editBrandName(project);
        });
    }
    
    // Add subfolder button event
    const btnAddSubfolder = header.querySelector('.btn-add-subfolder');
    if (btnAddSubfolder) {
        btnAddSubfolder.addEventListener('click', function(e) {
            e.stopPropagation();
            addSubfolder(project);
        });
    }
    
    div.appendChild(header);
    if (project.subProjects && project.subProjects.length > 0) {
        div.appendChild(content);
    }
    
    return div;
}

// Edit brand name
function editBrandName(project) {
    const activeYear = document.querySelector('.year-item.active');
    if (!activeYear) {
        alert('연도를 선택해주세요.');
        return;
    }
    
    const year = activeYear.getAttribute('data-year');
    const newName = prompt(`브랜드 이름을 수정하세요 (현재: ${project.name}):`, project.name);
    
    if (newName && newName.trim() !== '' && newName.trim() !== project.name) {
        const yearData = projectData[year];
        if (yearData) {
            const projectInData = yearData.projects.find(p => p.name === project.name);
            if (projectInData) {
                // Check if new name already exists
                const nameExists = yearData.projects.some(p => p.name === newName.trim() && p !== projectInData);
                if (nameExists) {
                    alert('이미 존재하는 브랜드 이름입니다.');
                    return;
                }
                
                // Update brand name
                projectInData.name = newName.trim();
                
                // Reload projects
                loadProjectsForYear(year);
                
                alert(`브랜드 이름이 "${project.name}"에서 "${newName.trim()}"로 변경되었습니다.`);
            }
        }
    } else if (newName !== null && newName.trim() === '') {
        alert('브랜드 이름을 입력해주세요.');
    }
}

// Edit subfolder name
function editSubfolderName(project, oldSubfolderName) {
    const activeYear = document.querySelector('.year-item.active');
    if (!activeYear) {
        alert('연도를 선택해주세요.');
        return;
    }
    
    const year = activeYear.getAttribute('data-year');
    const newName = prompt(`하위 폴더 이름을 수정하세요 (현재: ${oldSubfolderName}):`, oldSubfolderName);
    
    if (newName && newName.trim() !== '' && newName.trim() !== oldSubfolderName) {
        const yearData = projectData[year];
        if (yearData) {
            const projectInData = yearData.projects.find(p => p.name === project.name);
            if (projectInData && projectInData.subProjects) {
                // Check if new name already exists
                const nameExists = projectInData.subProjects.some(sp => sp === newName.trim() && sp !== oldSubfolderName);
                if (nameExists) {
                    alert('이미 존재하는 하위 폴더 이름입니다.');
                    return;
                }
                
                // Update subfolder name in subProjects array
                const index = projectInData.subProjects.indexOf(oldSubfolderName);
                if (index !== -1) {
                    projectInData.subProjects[index] = newName.trim();
                }
                
                // Update products object - move products from old name to new name
                if (projectInData.products && projectInData.products[oldSubfolderName]) {
                    projectInData.products[newName.trim()] = projectInData.products[oldSubfolderName];
                    delete projectInData.products[oldSubfolderName];
                }
                
                // Reload projects
                loadProjectsForYear(year);
                
                alert(`하위 폴더 이름이 "${oldSubfolderName}"에서 "${newName.trim()}"로 변경되었습니다.`);
            }
        }
    } else if (newName !== null && newName.trim() === '') {
        alert('하위 폴더 이름을 입력해주세요.');
    }
}

// Add subfolder to a project
function addSubfolder(project) {
    const subfolderName = prompt(`"${project.name}"에 추가할 하위 폴더 이름을 입력하세요:`);
    
    if (subfolderName && subfolderName.trim() !== '') {
        const activeYear = document.querySelector('.year-item.active');
        if (!activeYear) {
            alert('연도를 선택해주세요.');
            return;
        }
        
        const year = activeYear.getAttribute('data-year');
        const yearData = projectData[year];
        if (yearData) {
            const projectInData = yearData.projects.find(p => p.name === project.name);
            if (projectInData) {
                if (!projectInData.subProjects) {
                    projectInData.subProjects = [];
                }
                projectInData.subProjects.push(subfolderName.trim());
                
                if (!projectInData.products) {
                    projectInData.products = {};
                }
                projectInData.products[subfolderName.trim()] = [];
                
                loadProjectsForYear(year);
                alert(`하위 폴더 "${subfolderName.trim()}"가 "${project.name}"에 추가되었습니다.`);
            }
        }
    } else if (subfolderName !== null) {
        alert('하위 폴더 이름을 입력해주세요.');
    }
}

// Select main project - Show message
function selectMainProject(projectName, headerElement) {
    document.querySelectorAll('.project-main-header').forEach(h => {
        h.classList.remove('active');
    });
    document.querySelectorAll('.sub-project-item').forEach(item => {
        item.classList.remove('active');
    });
    
    headerElement.classList.add('active');
    
    const productDetail = document.getElementById('product-detail');
    if (productDetail) {
        productDetail.innerHTML = '<p class="empty-message">하위 폴더를 생성하고 선택한 후 제품명을 추가하세요</p>';
    }
}

// Select sub-project
function selectSubProject(subProjectName, element, brandName) {
    document.querySelectorAll('.project-main-header').forEach(h => {
        h.classList.remove('active');
    });
    document.querySelectorAll('.sub-project-item').forEach(item => {
        item.classList.remove('active');
    });
    
    element.classList.add('active');
    
    const activeYear = document.querySelector('.year-item.active');
    if (activeYear) {
        currentSelectedYear = activeYear.getAttribute('data-year');
    }
    currentSelectedBrand = brandName;
    
    loadProductsForSubProject(brandName, subProjectName);
}

// Add product to selected sub-project
function addProductToSubProject(brandName, subProjectName) {
    const activeYear = document.querySelector('.year-item.active');
    if (!activeYear) {
        alert('연도를 선택해주세요.');
        return;
    }
    
    const year = activeYear.getAttribute('data-year');
    const productName = prompt(`"${subProjectName}"에 추가할 제품명을 입력하세요:`);
    
    if (productName && productName.trim() !== '') {
        const yearData = projectData[year];
        if (!yearData) return;
        
        const brand = yearData.projects.find(p => p.name === brandName);
        if (!brand) return;
        
        if (!brand.products) {
            brand.products = {};
        }
        
        if (!brand.products[subProjectName]) {
            brand.products[subProjectName] = [];
        }
        
        if (brand.products[subProjectName].includes(productName.trim())) {
            alert('이미 존재하는 제품명입니다.');
            return;
        }
        
        brand.products[subProjectName].push(productName.trim());
        
        if (!productDetails[productName.trim()]) {
            productDetails[productName.trim()] = [
                { stage: 'Go Define', docs: ['Go Define.pdf', 'Go Define - GM confirmed.pdf'] },
                { stage: 'Go Develop', docs: ['Go Develop.pdf', 'Go Develop - GM confirmed.pdf'] },
                { stage: 'Go Implement', docs: ['Go Implement.pdf', 'Go Implement - GM confirmed.pdf'] },
                { stage: 'Go Launch', docs: ['Go Launch.pdf', 'Go Launch - GM confirmed.pdf'] },
                { stage: 'Closure', docs: ['Closure.pdf', 'Closure - GM confirmed.pdf'] }
            ];
        }
        
        currentSelectedYear = year;
        currentSelectedBrand = brandName;
        
        loadProductsForSubProject(brandName, subProjectName);
        alert(`제품명 "${productName.trim()}"이 "${subProjectName}"에 추가되었습니다.`);
    } else if (productName !== null) {
        alert('제품명을 입력해주세요.');
    }
}

// Load products for selected sub-project
function loadProductsForSubProject(brandName, subProjectName) {
    const productDetail = document.getElementById('product-detail');
    if (!productDetail) return;
    
    productDetail.innerHTML = '';
    
    const yearData = projectData[currentSelectedYear];
    if (!yearData) {
        productDetail.innerHTML = '<p class="empty-message">연도 데이터가 없습니다</p>';
        return;
    }
    
    const brand = yearData.projects.find(p => p.name === brandName);
    if (!brand) {
        productDetail.innerHTML = '<p class="empty-message">브랜드를 찾을 수 없습니다</p>';
        return;
    }
    
    if (!brand.products) {
        brand.products = {};
    }
    
    if (!brand.products[subProjectName]) {
        brand.products[subProjectName] = [];
    }
    
    const products = brand.products[subProjectName];
    
    if (products.length === 0) {
        productDetail.innerHTML = '<p class="empty-message">하위 폴더의 "+" 버튼을 클릭하여 제품명을 추가하세요</p>';
        return;
    }
    
    products.forEach((productName, index) => {
        const productItem = document.createElement('div');
        productItem.className = 'product-list-item';
        productItem.innerHTML = `
            <span class="product-icon">📦</span>
            <span class="product-name-text">${productName}</span>
            <button class="btn-delete-product" data-index="${index}" title="제품 삭제">×</button>
        `;
        
        productItem.addEventListener('click', function(e) {
            if (e.target.closest('.btn-delete-product')) {
                return;
            }
            
            document.querySelectorAll('.product-list-item').forEach(item => {
                item.classList.remove('active');
            });
            
            this.classList.add('active');
            showProductStages(productName);
        });
        
        const deleteBtn = productItem.querySelector('.btn-delete-product');
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm(`제품명 "${productName}"을(를) 삭제하시겠습니까?`)) {
                products.splice(index, 1);
                loadProductsForSubProject(brandName, subProjectName);
            }
        });
        
        productDetail.appendChild(productItem);
    });
}

// Show product stages
function showProductStages(productName) {
    const details = productDetails[productName];
    if (!details) {
        alert(`제품 "${productName}"의 상세 정보가 없습니다.`);
        return;
    }
    
    // Create a modal to show document stages
    showDocumentModal(productName, details);
}

// Show document modal
function showDocumentModal(productName, stages) {
    // Remove existing modal if any
    const existingModal = document.getElementById('document-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'document-modal';
    modal.className = 'modal-overlay';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Modal header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.innerHTML = `
        <h3>${productName}</h3>
        <div class="signature-label">대표님 서명페이지</div>
        <button class="btn-close-modal" title="닫기">×</button>
    `;
    
    // Modal body
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    stages.forEach((stage, stageIndex) => {
        const stageGroup = document.createElement('div');
        stageGroup.className = 'stage-group';
        
        stage.docs.forEach((doc, docIndex) => {
            const docItem = document.createElement('div');
            docItem.className = docIndex % 2 === 1 ? 'modal-doc-item confirmed' : 'modal-doc-item';
            
            const fileKey = `${productName}|${stage.stage}|${doc}`;
            const uploadedFile = uploadedFiles[fileKey];
            
            // Check if file is already uploaded
            const hasFile = uploadedFile ? 'has-file' : '';
            const btnText = uploadedFile ? '재업로드' : '업로드';
            const btnClass = uploadedFile ? 'btn-upload-doc uploaded' : 'btn-upload-doc';
            
            docItem.className += ` ${hasFile}`;
            
            docItem.innerHTML = `
                <span class="doc-icon">📄</span>
                <span class="doc-name">${doc}</span>
                <button class="${btnClass}" data-stage="${stage.stage}" data-doc="${doc}">${btnText}</button>
                <span class="upload-status ${uploadedFile ? 'uploaded' : ''}"></span>
            `;
            
            // Restore file status if exists
            if (uploadedFile) {
                const statusContainer = docItem.querySelector('.upload-status');
                statusContainer.innerHTML = `
                    <div class="file-info">
                        <span class="file-status-icon">✓</span>
                        <span class="file-name" title="${uploadedFile.name}">${uploadedFile.name}</span>
                        <span class="file-size">(${formatFileSize(uploadedFile.size)})</span>
                        <button class="btn-delete-file" data-key="${fileKey}" title="파일 삭제">×</button>
                    </div>
                `;
                
                // Add delete handler
                const deleteBtn = statusContainer.querySelector('.btn-delete-file');
                deleteBtn.addEventListener('click', function() {
                    const uploadBtn = docItem.querySelector('.btn-upload-doc');
                    deleteUploadedFile(fileKey, uploadBtn, statusContainer);
                });
            }
            
            // Upload button event
            const uploadBtn = docItem.querySelector('.btn-upload-doc');
            uploadBtn.addEventListener('click', function() {
                uploadDocument(productName, stage.stage, doc, this);
            });
            
            stageGroup.appendChild(docItem);
        });
        
        modalBody.appendChild(stageGroup);
    });
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    
    // Close button event
    const closeBtn = modalHeader.querySelector('.btn-close-modal');
    closeBtn.addEventListener('click', function() {
        modal.remove();
    });
    
    // Click outside to close
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Escape key to close
    document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    });
    
    document.body.appendChild(modal);
}

// Store uploaded files
const uploadedFiles = {};

// Upload document (simulated)
function uploadDocument(productName, stage, docName, buttonElement) {
    // Create file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.doc,.docx';
    
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Get status element and parent
            const statusContainer = buttonElement.nextElementSibling;
            const docItem = buttonElement.closest('.modal-doc-item');
            
            // Show uploading status
            buttonElement.disabled = true;
            buttonElement.textContent = '업로드 중...';
            buttonElement.className = 'btn-upload-doc uploading';
            statusContainer.innerHTML = '';
            
            // Simulate upload (in real app, this would be an API call)
            setTimeout(() => {
                // Store file info
                const fileKey = `${productName}|${stage}|${docName}`;
                uploadedFiles[fileKey] = {
                    name: file.name,
                    size: file.size,
                    uploadDate: new Date().toISOString(),
                    file: file
                };
                
                // Update UI
                buttonElement.disabled = false;
                buttonElement.textContent = '재업로드';
                buttonElement.className = 'btn-upload-doc uploaded';
                
                // Show file status with delete button
                statusContainer.innerHTML = `
                    <div class="file-info">
                        <span class="file-status-icon">✓</span>
                        <span class="file-name" title="${file.name}">${file.name}</span>
                        <span class="file-size">(${formatFileSize(file.size)})</span>
                        <button class="btn-delete-file" data-key="${fileKey}" title="파일 삭제">×</button>
                    </div>
                `;
                statusContainer.className = 'upload-status uploaded';
                
                // Add delete handler
                const deleteBtn = statusContainer.querySelector('.btn-delete-file');
                deleteBtn.addEventListener('click', function() {
                    deleteUploadedFile(fileKey, buttonElement, statusContainer);
                });
                
                // Mark document as uploaded
                docItem.classList.add('has-file');
            }, 1000);
        }
    });
    
    fileInput.click();
}

// Delete uploaded file
function deleteUploadedFile(fileKey, buttonElement, statusContainer) {
    const fileInfo = uploadedFiles[fileKey];
    if (!fileInfo) return;
    
    if (confirm(`파일 "${fileInfo.name}"을(를) 삭제하시겠습니까?`)) {
        // Remove from storage
        delete uploadedFiles[fileKey];
        
        // Reset button
        buttonElement.textContent = '업로드';
        buttonElement.className = 'btn-upload-doc';
        
        // Clear status
        statusContainer.innerHTML = '';
        statusContainer.className = 'upload-status';
        
        // Remove has-file class
        const docItem = buttonElement.closest('.modal-doc-item');
        docItem.classList.remove('has-file');
        
        alert('파일이 삭제되었습니다.');
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Keyboard navigation support
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey) {
        const tabs = document.querySelectorAll('.tab');
        const activeTab = document.querySelector('.tab.active');
        const currentIndex = Array.from(tabs).indexOf(activeTab);
        
        if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
            tabs[currentIndex + 1].click();
        } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
            tabs[currentIndex - 1].click();
        }
    }
    
    if (!e.ctrlKey && document.getElementById('archive-content').classList.contains('active')) {
        const yearItems = document.querySelectorAll('.year-item');
        const activeYear = document.querySelector('.year-item.active');
        
        if (activeYear) {
            const currentIndex = Array.from(yearItems).indexOf(activeYear);
            
            if (e.key === 'ArrowDown' && currentIndex < yearItems.length - 1) {
                yearItems[currentIndex + 1].click();
            } else if (e.key === 'ArrowUp' && currentIndex > 0) {
                yearItems[currentIndex - 1].click();
            }
        }
    }
});

// Ongoing Projects - Table Document Upload
function initOngoingTableUpload() {
    const ongoingContent = document.getElementById('ongoing-content');
    if (!ongoingContent) return;
    
    // Add event listeners to all upload buttons (table + decision section)
    ongoingContent.addEventListener('click', function(e) {
        // Handle upload button click
        if (e.target.classList.contains('btn-upload-doc-table')) {
            const cell = e.target.closest('.doc-upload-cell');
            handleTableDocUpload(cell);
        }
        
        // Handle delete button click
        if (e.target.classList.contains('btn-delete-doc-table')) {
            const cell = e.target.closest('.doc-upload-cell');
            handleTableDocDelete(cell);
        }
    });
}

// Handle table document upload
function handleTableDocUpload(cell) {
    const uploadBtn = cell.querySelector('.btn-upload-doc-table');
    const fileNameSpan = cell.querySelector('.doc-file-name');
    const deleteBtn = cell.querySelector('.btn-delete-doc-table');
    
    // Create file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx';
    
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Store file reference
            cell.dataset.fileName = file.name;
            cell.dataset.fileSize = file.size;
            
            // Update UI
            fileNameSpan.textContent = file.name;
            uploadBtn.textContent = '재선택';
            uploadBtn.classList.add('uploaded');
            deleteBtn.style.display = 'flex';
        }
    });
    
    fileInput.click();
}

// Handle table document delete
function handleTableDocDelete(cell) {
    const uploadBtn = cell.querySelector('.btn-upload-doc-table');
    const fileNameSpan = cell.querySelector('.doc-file-name');
    const deleteBtn = cell.querySelector('.btn-delete-doc-table');
    const fileName = cell.dataset.fileName;
    
    if (confirm(`파일 "${fileName}"을(를) 삭제하시겠습니까?`)) {
        // Clear file data
        delete cell.dataset.fileName;
        delete cell.dataset.fileSize;
        
        // Reset UI
        fileNameSpan.textContent = '';
        uploadBtn.textContent = '파일 선택';
        uploadBtn.classList.remove('uploaded');
        deleteBtn.style.display = 'none';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initOngoingTableUpload();
    initSaveButton();
    initExportButton();
});

// Store history records
const historyRecords = [];

// Initialize save button
function initSaveButton() {
    const saveBtn = document.querySelector('.btn-save');
    if (!saveBtn) return;
    
    saveBtn.addEventListener('click', function() {
        saveOngoingProject();
    });
}

// Save ongoing project to history
function saveOngoingProject() {
    // Get form data
    const brand = document.getElementById('ongoing-brand').value;
    const product = document.getElementById('ongoing-product').value;
    const project = document.getElementById('ongoing-project').value;
    const gate = document.getElementById('ongoing-gate').value;
    const year = document.getElementById('ongoing-year').value;
    
    // Validate required fields
    if (!brand) {
        alert('브랜드를 선택해주세요.');
        return;
    }
    if (!product) {
        alert('제품명을 입력해주세요.');
        return;
    }
    if (!project) {
        alert('프로젝트 명을 입력해주세요.');
        return;
    }
    if (!gate) {
        alert('Gate를 선택해주세요.');
        return;
    }
    if (!year) {
        alert('출시 년도를 선택해주세요.');
        return;
    }
    
    // Get table data
    const tableBody = document.getElementById('report-table-body');
    const rows = tableBody.querySelectorAll('tr');
    const reportData = [];
    
    rows.forEach(row => {
        const reportDate = row.querySelector('input[type="date"]').value;
        const docCell = row.querySelector('.doc-upload-cell');
        const docFileName = docCell.dataset.fileName || '';
        const meetingNote = row.querySelector('.table-input[placeholder="회의록 입력"]').value;
        
        if (reportDate || docFileName || meetingNote) {
            reportData.push({
                reportDate: reportDate,
                document: docFileName,
                meetingNote: meetingNote
            });
        }
    });
    
    // Get decision section data
    const signatureDate = document.querySelector('.decision-input').value;
    const decisionCell = document.querySelector('.decision-section .doc-upload-cell');
    const decisionDocument = decisionCell ? decisionCell.dataset.fileName || '' : '';
    
    // Get holding section data
    const holdingStatus = document.querySelector('.holding-select').value;
    const holdingReason = document.querySelector('.holding-input').value;
    
    // Create history record
    const record = {
        id: historyRecords.length + 1,
        timestamp: new Date().toLocaleString('ko-KR'),
        brand: brand,
        product: product,
        project: project,
        gate: gate,
        year: year,
        reports: reportData,
        signatureDate: signatureDate,
        decisionDocument: decisionDocument,
        holdingStatus: holdingStatus,
        holdingReason: holdingReason
    };
    
    // Add to history
    historyRecords.push(record);
    
    // Update history table
    updateHistoryTable();
    
    // Show success message
    alert('저장되었습니다!');
    
    // Clear form
    if (confirm('입력 내용을 초기화하시겠습니까?')) {
        clearOngoingForm();
    }
}

// Update history table
function updateHistoryTable() {
    const tbody = document.getElementById('history-tbody');
    
    // Remove empty row message
    const emptyRow = tbody.querySelector('.empty-row');
    if (emptyRow) {
        emptyRow.remove();
    }
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Add records
    historyRecords.forEach(record => {
        // For each report in the record
        if (record.reports.length > 0) {
            record.reports.forEach((report, index) => {
                const row = document.createElement('tr');
                
                // Only show record info in first row
                if (index === 0) {
                    row.innerHTML = `
                        <td rowspan="${record.reports.length}">${record.id}</td>
                        <td rowspan="${record.reports.length}">${record.timestamp}</td>
                        <td rowspan="${record.reports.length}">${record.brand}</td>
                        <td rowspan="${record.reports.length}">${record.product}</td>
                        <td rowspan="${record.reports.length}">${record.project}</td>
                        <td rowspan="${record.reports.length}">${record.gate}</td>
                        <td rowspan="${record.reports.length}">${record.year}</td>
                        <td>${report.reportDate || '-'}</td>
                        <td>${report.document ? `<span class="doc-link">📄 ${report.document}</span>` : '-'}</td>
                        <td>${report.meetingNote || '-'}</td>
                        <td rowspan="${record.reports.length}">${record.signatureDate || '-'}</td>
                        <td rowspan="${record.reports.length}">${record.holdingStatus || '-'}</td>
                        <td rowspan="${record.reports.length}">${record.holdingReason || '-'}</td>
                    `;
                } else {
                    row.innerHTML = `
                        <td>${report.reportDate || '-'}</td>
                        <td>${report.document ? `<span class="doc-link">📄 ${report.document}</span>` : '-'}</td>
                        <td>${report.meetingNote || '-'}</td>
                    `;
                }
                
                tbody.appendChild(row);
            });
        } else {
            // If no reports, show single row
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${record.id}</td>
                <td>${record.timestamp}</td>
                <td>${record.brand}</td>
                <td>${record.product}</td>
                <td>${record.project}</td>
                <td>${record.gate}</td>
                <td>${record.year}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>${record.signatureDate || '-'}</td>
                <td>${record.holdingStatus || '-'}</td>
                <td>${record.holdingReason || '-'}</td>
            `;
            tbody.appendChild(row);
        }
    });
}

// Clear ongoing form
function clearOngoingForm() {
    document.getElementById('ongoing-brand').value = '';
    document.getElementById('ongoing-product').value = '';
    document.getElementById('ongoing-project').value = '';
    document.getElementById('ongoing-gate').value = '';
    document.getElementById('ongoing-year').value = '';
    
    // Clear table
    const tableBody = document.getElementById('report-table-body');
    const rows = tableBody.querySelectorAll('tr');
    rows.forEach(row => {
        row.querySelector('input[type="date"]').value = '';
        const docCell = row.querySelector('.doc-upload-cell');
        const uploadBtn = docCell.querySelector('.btn-upload-doc-table');
        const fileNameSpan = docCell.querySelector('.doc-file-name');
        const deleteBtn = docCell.querySelector('.btn-delete-doc-table');
        
        delete docCell.dataset.fileName;
        delete docCell.dataset.fileSize;
        fileNameSpan.textContent = '';
        uploadBtn.textContent = '파일 선택';
        uploadBtn.classList.remove('uploaded');
        deleteBtn.style.display = 'none';
        
        row.querySelector('.table-input[placeholder="회의록 입력"]').value = '';
    });
    
    // Clear decision section
    document.querySelector('.decision-input').value = '';
    const decisionCell = document.querySelector('.decision-section .doc-upload-cell');
    if (decisionCell) {
        const uploadBtn = decisionCell.querySelector('.btn-upload-doc-table');
        const fileNameSpan = decisionCell.querySelector('.doc-file-name');
        const deleteBtn = decisionCell.querySelector('.btn-delete-doc-table');
        
        delete decisionCell.dataset.fileName;
        delete decisionCell.dataset.fileSize;
        fileNameSpan.textContent = '';
        uploadBtn.textContent = '파일 선택';
        uploadBtn.classList.remove('uploaded');
        deleteBtn.style.display = 'none';
    }
    
    // Clear holding section
    document.querySelector('.holding-select').value = '';
    document.querySelector('.holding-input').value = '';
}

// Initialize export button
function initExportButton() {
    const exportBtn = document.getElementById('btn-export-excel');
    if (!exportBtn) return;
    
    exportBtn.addEventListener('click', function() {
        exportToExcel();
    });
}

// Export history to Excel (CSV format)
function exportToExcel() {
    if (historyRecords.length === 0) {
        alert('저장된 기록이 없습니다.');
        return;
    }
    
    // Create CSV content
    let csv = '\uFEFF'; // BOM for UTF-8
    csv += '번호,저장일시,브랜드,제품명,프로젝트 명,Gate,출시 년도,보고날짜,문서,회의록,서명날짜,홀딩 상태,홀딩 사유\n';
    
    historyRecords.forEach(record => {
        if (record.reports.length > 0) {
            record.reports.forEach((report, index) => {
                if (index === 0) {
                    csv += `${record.id},"${record.timestamp}","${record.brand}","${record.product}","${record.project}","${record.gate}","${record.year}","${report.reportDate || '-'}","${report.document || '-'}","${report.meetingNote || '-'}","${record.signatureDate || '-'}","${record.holdingStatus || '-'}","${record.holdingReason || '-'}"\n`;
                } else {
                    csv += `,,,,,,,"${report.reportDate || '-'}","${report.document || '-'}","${report.meetingNote || '-'}",,, \n`;
                }
            });
        } else {
            csv += `${record.id},"${record.timestamp}","${record.brand}","${record.product}","${record.project}","${record.gate}","${record.year}","-","-","-","${record.signatureDate || '-'}","${record.holdingStatus || '-'}","${record.holdingReason || '-'}"\n`;
        }
    });
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `CODEV_History_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert('Excel 파일이 다운로드되었습니다.');
}
