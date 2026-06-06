// frontend/src/store/slices/studentsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import studentsApi from '../../api/studentsApi'

// ─────────────────────────────────────────────────────────────
//  ASYNC THUNKS
// ─────────────────────────────────────────────────────────────

// ── Students ──────────────────────────────────────────────────
export const fetchStudents = createAsyncThunk(
  'students/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      // Strip empty / null / undefined before hitting API
      const clean = {}
      Object.entries(params).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) clean[k] = v
      })
      return await studentsApi.getStudents(clean)
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Failed to fetch students'
      )
    }
  }
)

export const fetchStudent = createAsyncThunk(
  'students/fetchOne',
  async (id, { rejectWithValue }) => {
    try {
      return await studentsApi.getStudent(id)
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Student not found'
      )
    }
  }
)

export const fetchStudentStats = createAsyncThunk(
  'students/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      return await studentsApi.getStats()
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Failed to fetch stats'
      )
    }
  }
)

export const createStudent = createAsyncThunk(
  'students/create',
  async (payload, { rejectWithValue }) => {
    try {
      return await studentsApi.createStudent(payload)
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Failed to create student'
      )
    }
  }
)

export const updateStudent = createAsyncThunk(
  'students/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      return await studentsApi.updateStudent(id, data)
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Failed to update student'
      )
    }
  }
)

export const deleteStudent = createAsyncThunk(
  'students/delete',
  async (id, { rejectWithValue }) => {
    try {
      return await studentsApi.deleteStudent(id)
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Failed to delete student'
      )
    }
  }
)

// ── Guardians ─────────────────────────────────────────────────
export const addGuardian = createAsyncThunk(
  'students/addGuardian',
  async ({ studentId, data }, { rejectWithValue }) => {
    try {
      return await studentsApi.addGuardian(studentId, data)
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Failed to add guardian'
      )
    }
  }
)

export const updateGuardian = createAsyncThunk(
  'students/updateGuardian',
  async ({ guardianId, data }, { rejectWithValue }) => {
    try {
      return await studentsApi.updateGuardian(guardianId, data)
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Failed to update guardian'
      )
    }
  }
)

export const deleteGuardian = createAsyncThunk(
  'students/deleteGuardian',
  async ({ guardianId, studentId }, { rejectWithValue }) => {
    try {
      await studentsApi.deleteGuardian(guardianId)
      return { guardianId, studentId }
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Failed to remove guardian'
      )
    }
  }
)

// ── Enrollment ────────────────────────────────────────────────
export const enrollStudent = createAsyncThunk(
  'students/enroll',
  async ({ studentId, data }, { rejectWithValue }) => {
    try {
      return await studentsApi.enrollStudent(studentId, data)
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Failed to enroll student'
      )
    }
  }
)

// ── Grades ────────────────────────────────────────────────────
export const fetchGrades = createAsyncThunk(
  'students/fetchGrades',
  async (_, { rejectWithValue }) => {
    try {
      return await studentsApi.getGrades()
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Failed to fetch grades'
      )
    }
  }
)

export const createGrade = createAsyncThunk(
  'students/createGrade',
  async (payload, { rejectWithValue }) => {
    try {
      return await studentsApi.createGrade(payload)
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Failed to create grade'
      )
    }
  }
)

// ── Sections ──────────────────────────────────────────────────
export const fetchSections = createAsyncThunk(
  'students/fetchSections',
  async ({ gradeId, academicYearId }, { rejectWithValue }) => {
    try {
      return await studentsApi.getSections(gradeId, academicYearId)
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Failed to fetch sections'
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────
//  INITIAL STATE
// ─────────────────────────────────────────────────────────────
const initialState = {
  // List
  students: [],
  total:    0,
  page:     1,
  limit:    50,

  // Detail (full student with guardians + enrollments)
  selected:      null,
  detailLoading: false,

  // Dropdowns
  grades:   [],
  sections: [],

  // Dashboard stats
  stats: {
    total_active:    0,
    count_by_gender: {},
  },

  // Filters (persisted so back-navigation restores them)
  filters: {
    search:           '',
    gender:           '',
    is_active:        true,
    grade_id:         '',
    section_id:       '',
    academic_year_id: '',
  },

  // UI flags
  loading:        false,   // list loading
  saving:         false,   // create / update / guardian save
  error:          null,
  successMessage: null,
}

// ─────────────────────────────────────────────────────────────
//  SLICE
// ─────────────────────────────────────────────────────────────
const studentsSlice = createSlice({
  name: 'students',
  initialState,

  reducers: {
    setFilter: (state, action) => {
      state.filters = { ...state.filters, ...action.payload }
      state.page    = 1   // reset page on any filter change
    },
    setPage: (state, action) => {
      state.page = action.payload
    },
    clearSelected: (state) => {
      state.selected = null
    },
    clearError: (state) => {
      state.error = null
    },
    clearSuccess: (state) => {
      state.successMessage = null
    },
    resetFilters: (state) => {
      state.filters = initialState.filters
      state.page    = 1
    },
  },

  extraReducers: (builder) => {

    // ── Fetch list ───────────────────────────────────────────
    builder
      .addCase(fetchStudents.pending, (state) => {
        state.loading = true
        state.error   = null
      })
      .addCase(fetchStudents.fulfilled, (state, action) => {
        state.loading  = false
        state.students = action.payload.students
        state.total    = action.payload.total
        state.page     = action.payload.page
        state.limit    = action.payload.limit
      })
      .addCase(fetchStudents.rejected, (state, action) => {
        state.loading = false
        state.error   = action.payload
      })

    // ── Fetch single (for edit modal + detail page) ──────────
    builder
      .addCase(fetchStudent.pending, (state) => {
        state.detailLoading = true
        state.selected      = null   // clear previous while loading
        state.error         = null
      })
      .addCase(fetchStudent.fulfilled, (state, action) => {
        state.detailLoading = false
        state.selected      = action.payload
      })
      .addCase(fetchStudent.rejected, (state, action) => {
        state.detailLoading = false
        state.error         = action.payload
      })

    // ── Stats ────────────────────────────────────────────────
    builder.addCase(fetchStudentStats.fulfilled, (state, action) => {
      state.stats = action.payload
    })

    // ── Create ───────────────────────────────────────────────
    builder
      .addCase(createStudent.pending, (state) => {
        state.saving = true
        state.error  = null
      })
      .addCase(createStudent.fulfilled, (state, action) => {
        state.saving         = false
        state.successMessage = `${action.payload.first_name} added successfully`
        state.total         += 1
      })
      .addCase(createStudent.rejected, (state, action) => {
        state.saving = false
        state.error  = action.payload
      })

    // ── Update ───────────────────────────────────────────────
    builder
      .addCase(updateStudent.pending, (state) => {
        state.saving = true
        state.error  = null
      })
      .addCase(updateStudent.fulfilled, (state, action) => {
        state.saving         = false
        state.successMessage = 'Student updated successfully'
        state.selected       = action.payload
        // Patch list row so table reflects change without re-fetch
        const idx = state.students.findIndex(s => s.id === action.payload.id)
        if (idx !== -1) {
          state.students[idx] = {
            ...state.students[idx],
            first_name:   action.payload.first_name,
            last_name:    action.payload.last_name,
            admission_no: action.payload.admission_no,
            gender:       action.payload.gender,
            is_active:    action.payload.is_active,
          }
        }
      })
      .addCase(updateStudent.rejected, (state, action) => {
        state.saving = false
        state.error  = action.payload
      })

    // ── Delete (soft) ────────────────────────────────────────
    builder
      .addCase(deleteStudent.fulfilled, (state, action) => {
        state.successMessage = 'Student deactivated'
        state.students = state.students.filter(s => s.id !== action.payload)
        state.total    = Math.max(0, state.total - 1)
      })
      .addCase(deleteStudent.rejected, (state, action) => {
        state.error = action.payload
      })

    // ── Add Guardian ─────────────────────────────────────────
    builder
      .addCase(addGuardian.pending, (state) => {
        state.saving = true
        state.error  = null
      })
      .addCase(addGuardian.fulfilled, (state, action) => {
        state.saving         = false
        state.successMessage = 'Guardian added'
        // Append to selected student's guardian list
        if (state.selected) {
          state.selected = {
            ...state.selected,
            guardians: [...(state.selected.guardians || []), action.payload],
          }
        }
      })
      .addCase(addGuardian.rejected, (state, action) => {
        state.saving = false
        state.error  = action.payload
      })

    // ── Update Guardian ──────────────────────────────────────
    builder
      .addCase(updateGuardian.fulfilled, (state, action) => {
        state.successMessage = 'Guardian updated'
        if (state.selected?.guardians) {
          const idx = state.selected.guardians.findIndex(
            g => g.id === action.payload.id
          )
          if (idx !== -1) {
            state.selected.guardians[idx] = action.payload
          }
        }
      })
      .addCase(updateGuardian.rejected, (state, action) => {
        state.error = action.payload
      })

    // ── Delete Guardian ──────────────────────────────────────
    builder
      .addCase(deleteGuardian.fulfilled, (state, action) => {
        state.successMessage = 'Guardian removed'
        if (state.selected?.guardians) {
          state.selected = {
            ...state.selected,
            guardians: state.selected.guardians.filter(
              g => g.id !== action.payload.guardianId
            ),
          }
        }
      })
      .addCase(deleteGuardian.rejected, (state, action) => {
        state.error = action.payload
      })

    // ── Enroll ───────────────────────────────────────────────
    builder
      .addCase(enrollStudent.fulfilled, (state, action) => {
        state.successMessage = 'Student enrolled'
        if (state.selected) {
          state.selected = {
            ...state.selected,
            enrollments: [...(state.selected.enrollments || []), action.payload],
          }
        }
      })
      .addCase(enrollStudent.rejected, (state, action) => {
        state.error = action.payload
      })

    // ── Grades ───────────────────────────────────────────────
    builder
      .addCase(fetchGrades.fulfilled, (state, action) => {
        state.grades = action.payload
      })
      .addCase(createGrade.fulfilled, (state, action) => {
        state.grades.push(action.payload)
      })

    // ── Sections ─────────────────────────────────────────────
    builder.addCase(fetchSections.fulfilled, (state, action) => {
      state.sections = action.payload
    })
  },
})

export const {
  setFilter,
  setPage,
  clearSelected,
  clearError,
  clearSuccess,
  resetFilters,
} = studentsSlice.actions

export default studentsSlice.reducer

// ─────────────────────────────────────────────────────────────
//  SELECTORS
// ─────────────────────────────────────────────────────────────
export const selectStudents            = (s) => s.students.students
export const selectStudentsTotal       = (s) => s.students.total
export const selectStudentsPage        = (s) => s.students.page
export const selectStudentsLimit       = (s) => s.students.limit
export const selectSelectedStudent     = (s) => s.students.selected
export const selectStudentDetailLoading = (s) => s.students.detailLoading
export const selectStudentStats        = (s) => s.students.stats
export const selectGrades              = (s) => s.students.grades
export const selectSections            = (s) => s.students.sections
export const selectStudentsLoading     = (s) => s.students.loading
export const selectStudentsSaving      = (s) => s.students.saving
export const selectStudentsError       = (s) => s.students.error
export const selectStudentsSuccess     = (s) => s.students.successMessage
export const selectStudentsFilters     = (s) => s.students.filters
