import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProjectById, updateProject, UpdateProjectPayload } from '../api/projectService';
import { getPromptTemplates, PromptTemplate } from '../api/promptTemplateService';
import { LANGUAGES, DOMAINS, INDUSTRIES, PRIORITIES } from '../constants/projectConstants'; // Import constants

const EditProjectPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [languagePairs, setLanguagePairs] = useState([{ source: '', target: '' }]);
  const [deadline, setDeadline] = useState(''); // Store as string YYYY-MM-DD
  const [priority, setPriority] = useState<number | ''>('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  // State for prompt templates
  const [translationTemplates, setTranslationTemplates] = useState<PromptTemplate[]>([]);
  const [reviewTemplates, setReviewTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTransPrompt, setSelectedTransPrompt] = useState<string>('');
  const [selectedRevPrompt, setSelectedRevPrompt] = useState<string>('');

  // Loading/Error state
  const [isLoadingPage, setIsLoadingPage] = useState(true); // Combined loading state
  const [isUpdating, setIsUpdating] = useState(false); // Separate state for update operation
  const [error, setError] = useState<string | null>(null);

  // Fetch existing project data AND prompt templates
  useEffect(() => {
    if (!projectId) {
      setError('项目 ID 缺失');
      setIsLoadingPage(false);
      return;
    }

    const loadData = async () => {
      setIsLoadingPage(true);
      setError(null);
      try {
        // Fetch project details and templates concurrently
        const [projectResponse, templatesResponse] = await Promise.all([
          getProjectById(projectId),
          getPromptTemplates()
        ]);

        // Process project data
        if (projectResponse.success && projectResponse.data) {
          const project = projectResponse.data;
          setName(project.name);
          setDescription(project.description || '');
          setLanguagePairs(project.languagePairs?.length ? project.languagePairs : [{ source: '', target: '' }]);
          // Format date for input type='date' (YYYY-MM-DD)
          setDeadline(project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : '');
          setPriority(project.priority ?? '');
          setDomain(project.domain || '');
          setIndustry(project.industry || '');
          // Set initial selected templates safely accessing _id
          setSelectedTransPrompt(project.defaultTranslationPromptTemplate?._id || '');
          setSelectedRevPrompt(project.defaultReviewPromptTemplate?._id || '');
          // TODO: Handle project-specific templates (translationPromptTemplate, reviewPromptTemplate) if needed

        } else {
          setError(projectResponse.message || '获取项目详情失败');
        }

        // Process templates data
        if (templatesResponse.success && templatesResponse.data?.templates) {
            const allTemplates = templatesResponse.data.templates;
            setTranslationTemplates(allTemplates.filter(t => t.type === 'translation'));
            setReviewTemplates(allTemplates.filter(t => t.type === 'review'));
        } else {
            console.error('Failed to fetch prompt templates:', templatesResponse.message);
            setError(prev => prev ? `${prev}; 无法加载提示词模板` : '无法加载提示词模板'); // Append or set error
        }

      } catch (err: any) {
        console.error('Error loading edit page data:', err);
        setError(err.response?.data?.message || err.message || '加载编辑数据时出错');
      } finally {
        setIsLoadingPage(false);
      }
    };

    loadData();
  }, [projectId]);

  // Handlers for language pairs (same as CreateProjectPage)
  const handleAddLanguagePair = () => {
    setLanguagePairs([...languagePairs, { source: '', target: '' }]);
  };

  const handleLanguagePairChange = (index: number, field: 'source' | 'target', value: string) => {
    const updatedPairs = [...languagePairs];
    updatedPairs[index][field] = value;
    setLanguagePairs(updatedPairs);
  };

  const handleRemoveLanguagePair = (index: number) => {
    if (languagePairs.length > 1) {
      const updatedPairs = languagePairs.filter((_, i) => i !== index);
      setLanguagePairs(updatedPairs);
    }
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) { setError('无法在没有项目ID的情况下更新'); return; }
    setError(null);
    setIsUpdating(true);

    // Validation (same as CreateProjectPage)
    if (!name.trim()) { setError('项目名称不能为空'); setIsUpdating(false); return; }
    const validLanguagePairs = languagePairs.filter(pair => pair.source.trim() && pair.target.trim());
    if (validLanguagePairs.length === 0) { setError('至少需要一个有效的语言对'); setIsUpdating(false); return; }
    // Add prompt template validation if needed

    const payload: UpdateProjectPayload = {
      // Only include fields that might have changed
      name: name.trim(),
      description: description.trim() || undefined,
      languagePairs: validLanguagePairs.map(pair => ({ source: pair.source.trim(), target: pair.target.trim() })),
      deadline: deadline ? `${deadline}T00:00:00.000Z` : undefined,
      priority: priority === '' ? undefined : Number(priority),
      domain: domain.trim() || undefined,
      industry: industry.trim() || undefined,
      // Add selected prompt template IDs
      defaultTranslationPromptTemplate: selectedTransPrompt || undefined,
      defaultReviewPromptTemplate: selectedRevPrompt || undefined,
    };

    try {
      const response = await updateProject(projectId, payload);
      if (response.success && response.data?.project) {
        console.log('Project updated:', response.data.project);
        navigate(`/projects/${projectId}`);
      } else {
        setError(response.message || '更新项目失败，未知错误。');
      }
    } catch (err: any) {
      console.error('Update project error:', err);
       // Attempt to parse details if available from backend error handling
      let detailedError = '更新项目时发生错误。';
      if (err.response?.data?.details) {
        try {
          // Format the Zod error details for display
          const errorDetails = err.response.data.details;
          const fieldErrors = Object.entries(errorDetails.fieldErrors || {})
            .map(([field, messages]) => `${field}: ${(messages as string[]).join(', ')}`)
            .join('; ');
          const formErrors = (errorDetails.formErrors || []).join(', ');
          detailedError = `验证失败: ${formErrors} ${fieldErrors}`.trim();
        } catch (e) { 
          // Fallback if details parsing fails
          detailedError = err.response?.data?.message || err.message || detailedError;
        } 
      } else {
          detailedError = err.response?.data?.message || err.message || detailedError;
      }
      setError(detailedError);
    } finally {
      setIsUpdating(false);
    }
  };

  // Render logic
  if (isLoadingPage) {
    return <p>正在加载项目详情和模板...</p>;
  }

  // Show error only if not updating (to avoid flicker)
  if (error && !isUpdating) {
    return <p style={{ color: 'red' }}>错误: {error}</p>;
  }

  return (
    <div>
      <h1>编辑项目: {name}</h1>
      <form onSubmit={handleSubmit}>
        {/* Project Name */}
        <div>
          <label htmlFor="projectName">项目名称:</label>
          <input
            type="text"
            id="projectName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isUpdating}
          />
        </div>

        {/* Description */}
        <div style={{ marginTop: '1rem' }}>
          <label htmlFor="projectDescription">描述 (可选):</label>
          <textarea
            id="projectDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isUpdating}
            rows={3}
          />
        </div>

        {/* Language Pairs - Now Selects */}
        <div style={{ marginTop: '1rem' }}>
          <h3>语言对</h3>
          {languagePairs.map((pair, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              {/* Source Language Select */}
              <select
                value={pair.source}
                onChange={(e) => handleLanguagePairChange(index, 'source', e.target.value)}
                required
                disabled={isUpdating}
                style={{ marginRight: '0.5rem', minWidth: '150px' }}
              >
                <option value="" disabled>选择源语言</option>
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>

              <span>-&gt;</span>

              {/* Target Language Select */}
              <select
                value={pair.target}
                onChange={(e) => handleLanguagePairChange(index, 'target', e.target.value)}
                required
                disabled={isUpdating}
                style={{ marginLeft: '0.5rem', marginRight: '0.5rem', minWidth: '150px' }}
              >
                <option value="" disabled>选择目标语言</option>
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>

              {languagePairs.length > 1 && (
                <button type="button" onClick={() => handleRemoveLanguagePair(index)} disabled={isUpdating}>
                  移除
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={handleAddLanguagePair} disabled={isUpdating}>
            添加语言对
          </button>
        </div>

        {/* Other Fields: Deadline, Priority, Domain, Industry */}
        <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label htmlFor="projectDeadline">截止日期 (可选):</label>
            <input
              type="date"
              id="projectDeadline"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={isUpdating}
            />
          </div>
          <div>
            <label htmlFor="projectPriority">优先级 (可选):</label>
            <select
              id="projectPriority"
              value={priority}
              onChange={(e) => setPriority(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              disabled={isUpdating}
            >
              <option value="">选择优先级</option>
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label} ({p.value})</option>
              ))}
            </select>
          </div>
          {/* Domain Select */}
          <div>
            <label htmlFor="projectDomain">领域 (可选):</label>
            <select
              id="projectDomain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={isUpdating}
            >
              <option value="">选择领域</option>
              {DOMAINS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          {/* Industry Select */}
          <div>
            <label htmlFor="projectIndustry">行业 (可选):</label>
            <select
              id="projectIndustry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              disabled={isUpdating}
            >
              <option value="">选择行业</option>
              {INDUSTRIES.map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Prompt Template Selection */}
        <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
                <label htmlFor="transPrompt">默认翻译提示词 (可选):</label>
                <select
                    id="transPrompt"
                    value={selectedTransPrompt}
                    onChange={(e) => setSelectedTransPrompt(e.target.value)}
                    disabled={isUpdating}
                >
                    <option value="">选择翻译提示词</option>
                    {translationTemplates.map(t => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="revPrompt">默认审校提示词 (可选):</label>
                <select
                    id="revPrompt"
                    value={selectedRevPrompt}
                    onChange={(e) => setSelectedRevPrompt(e.target.value)}
                    disabled={isUpdating}
                >
                    <option value="">选择审校提示词</option>
                    {reviewTemplates.map(t => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* Error Display (Show update errors) */}
        {error && <p style={{ color: 'red', marginTop: '1rem' }}>错误: {error}</p>}

        {/* Submit Button */}
        <div style={{ marginTop: '1.5rem' }}>
          <button type="submit" disabled={isUpdating || isLoadingPage}>
            {isUpdating ? '更新中...' : '保存更改'}
          </button>
          {/* Navigate back to detail page on cancel */}
          <button type="button" onClick={() => navigate(projectId ? `/projects/${projectId}` : '/projects')} disabled={isUpdating || isLoadingPage} style={{ marginLeft: '1rem' }}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProjectPage; 