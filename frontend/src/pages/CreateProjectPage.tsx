import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject, CreateProjectPayload } from '../api/projectService';
import { getPromptTemplates, PromptTemplate } from '../api/promptTemplateService';
import { getReviewers, User } from '../api/userService';
import { LANGUAGES, DOMAINS, INDUSTRIES, PRIORITIES } from '../constants/projectConstants';

const CreateProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [languagePairs, setLanguagePairs] = useState([{ source: '', target: '' }]);
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<number | ''>('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [translationTemplates, setTranslationTemplates] = useState<PromptTemplate[]>([]);
  const [reviewTemplates, setReviewTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTransPrompt, setSelectedTransPrompt] = useState<string>('');
  const [selectedRevPrompt, setSelectedRevPrompt] = useState<string>('');
  const [availableReviewers, setAvailableReviewers] = useState<User[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingPage(true);
      setError(null);
      try {
        const [templateResponse, reviewerResponse] = await Promise.all([
          getPromptTemplates(),
          getReviewers()
        ]);

        if (templateResponse.success && templateResponse.data?.templates) {
          const allTemplates = templateResponse.data.templates;
          setTranslationTemplates(allTemplates.filter(t => t.taskType === 'translation'));
          setReviewTemplates(allTemplates.filter(t => t.taskType === 'review'));
        } else {
          console.error('Failed to fetch prompt templates:', templateResponse.message);
          setError((prevError) => (prevError ? prevError + '; ' : '') + '无法加载提示词模板列表');
        }

        if (reviewerResponse.success && reviewerResponse.data?.users) {
          setAvailableReviewers(reviewerResponse.data.users);
        } else {
          console.error('Failed to fetch reviewers:', reviewerResponse.message);
          setError((prevError) => (prevError ? prevError + '; ' : '') + '无法加载审校人员列表');
        }

      } catch (err) {
        console.error('Error fetching initial data:', err);
        setError('加载页面数据时出错');
      } finally {
        setIsLoadingPage(false);
      }
    };
    fetchData();
  }, []);

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

  const handleReviewerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
    setSelectedReviewers(selectedOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    if (!name.trim()) {
      setError('项目名称不能为空');
      setIsCreating(false);
      return;
    }
    const validLanguagePairs = languagePairs.filter(pair => pair.source.trim() && pair.target.trim());
    if (validLanguagePairs.length === 0) {
      setError('至少需要一个有效的语言对');
      setIsCreating(false);
      return;
    }

    const payload: CreateProjectPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      languagePairs: validLanguagePairs.map(pair => ({ source: pair.source.trim(), target: pair.target.trim() })),
      deadline: deadline ? `${deadline}T00:00:00.000Z` : undefined,
      priority: priority === '' ? undefined : Number(priority),
      domain: domain.trim() || undefined,
      industry: industry.trim() || undefined,
      defaultTranslationPromptTemplate: selectedTransPrompt || undefined,
      defaultReviewPromptTemplate: selectedRevPrompt || undefined,
      reviewers: selectedReviewers.length > 0 ? selectedReviewers : undefined,
    };

    try {
      const response = await createProject(payload);
      if (response.success && response.data?.project) {
        console.log('Project created:', response.data.project);
        navigate('/projects');
      } else {
        setError(response.message || '创建项目失败，未知错误。');
      }
    } catch (err: any) {
      console.error('Create project error:', err);
      let detailedError = '创建项目时发生错误。';
      if (err.response?.data?.details) {
        try {
          const errorDetails = err.response.data.details;
          const fieldErrors = Object.entries(errorDetails.fieldErrors || {})
            .map(([field, messages]) => `${field}: ${(messages as string[]).join(', ')}`)
            .join('; ');
          const formErrors = (errorDetails.formErrors || []).join(', ');
          detailedError = `验证失败: ${formErrors} ${fieldErrors}`.trim();
        } catch (e) {
          detailedError = err.response?.data?.message || err.message || detailedError;
        }
      } else {
        detailedError = err.response?.data?.message || err.message || detailedError;
      }
      setError(detailedError);
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoadingPage) {
    return <p>正在加载页面和模板...</p>;
  }

  return (
    <div>
      <h1>创建新项目</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="projectName">项目名称:</label>
          <input
            type="text"
            id="projectName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isCreating}
          />
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label htmlFor="projectDescription">描述 (可选):</label>
          <textarea
            id="projectDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isCreating}
            rows={3}
          />
        </div>

        <div style={{ marginTop: '1rem' }}>
          <h3>语言对</h3>
          {languagePairs.map((pair, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <select
                value={pair.source}
                onChange={(e) => handleLanguagePairChange(index, 'source', e.target.value)}
                required
                disabled={isCreating}
                style={{ marginRight: '0.5rem', minWidth: '150px' }}
              >
                <option value="" disabled>选择源语言</option>
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>

              <span>-&gt;</span>

              <select
                value={pair.target}
                onChange={(e) => handleLanguagePairChange(index, 'target', e.target.value)}
                required
                disabled={isCreating}
                style={{ marginLeft: '0.5rem', marginRight: '0.5rem', minWidth: '150px' }}
              >
                <option value="" disabled>选择目标语言</option>
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>

              {languagePairs.length > 1 && (
                <button type="button" onClick={() => handleRemoveLanguagePair(index)} disabled={isCreating}>
                  移除
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={handleAddLanguagePair} disabled={isCreating}>
            添加语言对
          </button>
        </div>

        <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label htmlFor="projectDeadline">截止日期 (可选):</label>
            <input
              type="date"
              id="projectDeadline"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={isCreating}
            />
          </div>
          <div>
            <label htmlFor="projectPriority">优先级 (可选):</label>
            <select
              id="projectPriority"
              value={priority}
              onChange={(e) => setPriority(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              disabled={isCreating}
            >
              <option value="">选择优先级</option>
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label} ({p.value})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="projectDomain">领域 (可选):</label>
            <select
              id="projectDomain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={isCreating}
            >
              <option value="">选择领域</option>
              {DOMAINS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="projectIndustry">行业 (可选):</label>
            <select
              id="projectIndustry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              disabled={isCreating}
            >
              <option value="">选择行业</option>
              {INDUSTRIES.map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label htmlFor="transPrompt">默认翻译提示词 (可选):</label>
            <select
              id="transPrompt"
              value={selectedTransPrompt}
              onChange={(e) => setSelectedTransPrompt(e.target.value)}
              disabled={isCreating}
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
              disabled={isCreating}
            >
              <option value="">选择审校提示词</option>
              {reviewTemplates.map(t => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label htmlFor="projectReviewers">审校人员 (可选, 按住Ctrl/Cmd多选):</label>
          <select
            id="projectReviewers"
            multiple
            value={selectedReviewers}
            onChange={handleReviewerChange}
            disabled={isCreating || availableReviewers.length === 0}
            style={{ minHeight: '100px' }}
          >
            {availableReviewers.length === 0 && <option disabled>正在加载或无可用审校人员...</option>}
            {availableReviewers.map(user => (
              <option key={user._id} value={user._id}>
                {user.username} ({user.email})
              </option>
            ))}
          </select>
        </div>

        {error && <p style={{ color: 'red', marginTop: '1rem' }}>错误: {error}</p>}

        <div style={{ marginTop: '1.5rem' }}>
          <button type="submit" disabled={isCreating || isLoadingPage}>
            {isCreating ? '创建中...' : '创建项目'}
          </button>
          <button type="button" onClick={() => navigate('/projects')} disabled={isCreating || isLoadingPage} style={{ marginLeft: '1rem' }}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateProjectPage; 